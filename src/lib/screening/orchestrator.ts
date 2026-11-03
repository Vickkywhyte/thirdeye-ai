import { createAdminClient } from '@/lib/supabase/admin'
import { sanctionsProvider } from './sanctions'
import { pepProvider } from './pep'
import { adverseMediaProvider } from './adverse-media'
import { registryProvider } from './registry'
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
  const supabase = createAdminClient()

  const screeningPromises = types.map(async (type) => {
    const provider = PROVIDERS[type]
    if (!provider) {
      return {
        type,
        hits: [],
        rawData: {},
        error: `Unknown screening type: ${type}`,
      } satisfies ScreeningResult
    }

    await supabase
      .from('screening_results')
      .update({
        status: 'running' as const,
        started_at: new Date().toISOString(),
      })
      .eq('investigation_id', investigationId)
      .eq('type', type as 'sanctions' | 'pep' | 'adverse_media' | 'registry')

    try {
      const result = await provider.screen(entity)

      await supabase
        .from('screening_results')
        .update({
          status: (result.error ? 'failed' : 'completed') as 'failed' | 'completed',
          hit_count: result.hits.length,
          raw_data: result.rawData as import('@/types/database').Json,
          error_message: result.error ?? null,
          completed_at: new Date().toISOString(),
        })
        .eq('investigation_id', investigationId)
        .eq('type', type as 'sanctions' | 'pep' | 'adverse_media' | 'registry')

      if (result.hits.length > 0) {
        const hitRows = result.hits.map((hit) => ({
          result_id: '',
          source: hit.source,
          match_score: hit.matchScore,
          matched_name: hit.matchedName,
          data: hit.data as import('@/types/database').Json,
          is_confirmed: false,
        }))

        const { data: screeningResult } = await supabase
          .from('screening_results')
          .select('id')
          .eq('investigation_id', investigationId)
          .eq('type', type as 'sanctions' | 'pep' | 'adverse_media' | 'registry')
          .single()

        if (screeningResult) {
          const rowsWithResultId = hitRows.map((row) => ({
            ...row,
            result_id: screeningResult.id,
          }))
          await supabase.from('screening_hits').insert(rowsWithResultId)
        }
      }

      return result
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Screening failed'

      await supabase
        .from('screening_results')
        .update({
          status: 'failed' as const,
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
        })
        .eq('investigation_id', investigationId)
        .eq('type', type as 'sanctions' | 'pep' | 'adverse_media' | 'registry')

      return {
        type,
        hits: [],
        rawData: {},
        error: errorMsg,
      } satisfies ScreeningResult
    }
  })

  const results = await Promise.all(screeningPromises)
  const riskScore = calculateRiskScore(results)

  await supabase
    .from('investigations')
    .update({ risk_score: riskScore })
    .eq('id', investigationId)

  await supabase.from('timeline_events').insert({
    investigation_id: investigationId,
    event_type: 'screening_completed',
    title: 'Screening completed',
    description: `Risk score: ${riskScore}/100. ${results.reduce((sum, r) => sum + r.hits.length, 0)} total hits across ${types.length} checks.`,
  })

  return { results, riskScore }
}
