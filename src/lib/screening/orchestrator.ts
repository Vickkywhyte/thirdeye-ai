import { createLogger } from '@/lib/monitoring/logger'
import { measureAsync } from '@/lib/monitoring/performance'
import { createAdminClient } from '@/lib/supabase/admin'
import { ingestOwnership } from '@/lib/graph/ingest-ownership'

const logger = createLogger('screening-orchestrator')
import { sanctionsProvider } from './sanctions'
import { pepProvider } from './pep'
import { adverseMediaProvider } from './adverse-media'
import { registryProvider } from './registry'
import { applicableScreeningTypes } from './types'
import type {
  ScreeningEntity,
  ScreeningProvider,
  ScreeningResult,
  ScreeningTypeValue,
} from './types'

const PROVIDERS: Record<ScreeningTypeValue, ScreeningProvider> = {
  sanctions: sanctionsProvider,
  pep: pepProvider,
  adverse_media: adverseMediaProvider,
  registry: registryProvider,
}

const RISK_WEIGHTS: Record<ScreeningTypeValue, number> = {
  sanctions: 0.4,
  pep: 0.25,
  adverse_media: 0.2,
  registry: 0.15,
}

function calculateRiskScore(results: ScreeningResult[]): number {
  let weightedScore = 0

  for (const result of results) {
    if (result.error && result.hits.length === 0) continue

    const weight = RISK_WEIGHTS[result.type] ?? 0
    const hitCount = result.hits.length

    if (hitCount === 0) continue

    const maxHitScore = Math.max(...result.hits.map((h) => h.matchScore))
    const logBoost = Math.min(1.5, 1 + Math.log2(hitCount) * 0.15)
    const typeScore = Math.min(100, maxHitScore * logBoost)

    weightedScore += typeScore * weight
  }

  return Math.round(Math.min(100, weightedScore))
}

export async function runScreening(
  investigationId: string,
  types: ScreeningTypeValue[],
  entity: ScreeningEntity
): Promise<{ results: ScreeningResult[]; riskScore: number }> {
  // Registry checks don't apply to a natural person. Filtered here too, so any
  // caller gets the same behaviour as the screening route.
  const effectiveTypes = applicableScreeningTypes(entity.type, types)
  const skipped = types.filter((t) => !effectiveTypes.includes(t))
  if (skipped.length > 0) {
    logger.info('Skipping checks that do not apply to this entity type', {
      investigationId,
      entityType: entity.type,
      skipped,
    })
  }

  logger.info('Starting screening', {
    investigationId,
    types: effectiveTypes,
    entityName: entity.name,
  })
  const supabase = createAdminClient()

  const screeningPromises = effectiveTypes.map(async (type) => {
    const provider = PROVIDERS[type]
    if (!provider) {
      return {
        type,
        hits: [],
        rawData: {},
        error: `Unknown screening type: ${type}`,
      } satisfies ScreeningResult
    }

    // Resolve the row's primary key once. Every write below targets it by id,
    // so a mismatched filter can never silently update zero rows.
    const { data: resultRow, error: rowErr } = await supabase
      .from('screening_results')
      .select('id')
      .eq('investigation_id', investigationId)
      .eq('type', type as 'sanctions' | 'pep' | 'adverse_media' | 'registry')
      .single()

    if (rowErr || !resultRow) {
      const msg = `No screening_results row for type "${type}" — it must be created before screening runs`
      logger.error(msg, { investigationId, error: rowErr?.message ?? null })
      return {
        type,
        hits: [],
        rawData: {},
        error: msg,
      } satisfies ScreeningResult
    }

    const resultId = resultRow.id

    const nowRunning = new Date().toISOString()
    const { error: runningErr } = await supabase
      .from('screening_results')
      .update({
        status: 'running' as const,
        started_at: nowRunning,
        last_updated_at: nowRunning,
      })
      .eq('id', resultId)

    if (runningErr) {
      logger.error(`Failed to mark ${type} as running`, {
        investigationId,
        resultId,
        error: runningErr.message,
      })
    }

    try {
      logger.info(`Running provider: ${type}`, { investigationId })
      const result = await provider.screen(entity)
      logger.info(`Provider ${type} finished`, { hits: result.hits.length, error: result.error ?? null })

      const nowCompleted = new Date().toISOString()
      const { error: updateErr } = await supabase
        .from('screening_results')
        .update({
          status: (result.error ? 'failed' : 'completed') as 'failed' | 'completed',
          hit_count: result.hits.length,
          raw_data: result.rawData as import('@/types/database').Json,
          error_message: result.error ?? null,
          completed_at: nowCompleted,
          last_updated_at: nowCompleted,
        })
        .eq('id', resultId)

      if (updateErr) {
        logger.error(`Failed to update screening_results for ${type}`, {
          investigationId,
          resultId,
          error: updateErr.message,
        })
      }

      // Registry results carry PSC/officer relationships. Persist them as
      // graph edges -- without this the ownership graph only ever has the
      // subject node, because nothing else writes to ownership_links.
      if (result.ownership && result.ownership.length > 0) {
        try {
          const ingested = await ingestOwnership(
            investigationId,
            result.ownership
          )
          logger.info('Ownership relationships persisted', {
            investigationId,
            type,
            ...ingested,
          })
        } catch (err) {
          logger.error('Failed persisting ownership relationships', {
            investigationId,
            type,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      if (result.hits.length > 0) {
        const hitRows = result.hits.map((hit) => ({
          result_id: resultId,
          source: hit.source,
          match_score: hit.matchScore,
          matched_name: hit.matchedName,
          data: hit.data as import('@/types/database').Json,
          is_confirmed: false,
        }))

        const { error: hitsErr } = await supabase
          .from('screening_hits')
          .insert(hitRows)

        if (hitsErr) {
          logger.error(`Failed to insert screening_hits for ${type}`, {
            investigationId,
            resultId,
            hitCount: hitRows.length,
            error: hitsErr.message,
          })
        }
      }

      return result
    } catch (err) {
      // A provider that throws must not take down its siblings. We mark
      // just this row 'failed' with the error captured, and the outer
      // Promise.all still awaits every other provider.
      const errorMsg =
        err instanceof Error ? err.message : 'Screening failed'

      logger.error(`Provider ${type} threw — isolating failure`, {
        investigationId,
        resultId,
        error: errorMsg,
      })

      const nowFailed = new Date().toISOString()
      await supabase
        .from('screening_results')
        .update({
          status: 'failed' as const,
          error_message: errorMsg,
          completed_at: nowFailed,
          last_updated_at: nowFailed,
        })
        .eq('id', resultId)

      return {
        type,
        hits: [],
        rawData: {},
        error: errorMsg,
      } satisfies ScreeningResult
    }
  })

  const results = await measureAsync('screening.runAll', () => Promise.all(screeningPromises))
  const riskScore = calculateRiskScore(results)
  logger.info('Screening completed', {
    investigationId,
    riskScore,
    totalHits: results.reduce((sum, r) => sum + r.hits.length, 0),
  })

  await supabase
    .from('investigations')
    .update({ risk_score: riskScore })
    .eq('id', investigationId)

  await supabase.from('timeline_events').insert({
    investigation_id: investigationId,
    event_type: 'screening_completed',
    title: 'Screening completed',
    description: `Risk score: ${riskScore}/100. ${results.reduce((sum, r) => sum + r.hits.length, 0)} total hits across ${effectiveTypes.length} checks.`,
  })

  return { results, riskScore }
}
