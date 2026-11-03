import {
  SCREENING_TYPES,
  classifySeverity,
  type ScreeningEntity,
  type ScreeningHit,
  type ScreeningProvider,
  type ScreeningResult,
} from './types'

const OPENSANCTIONS_MATCH_URL =
  'https://api.opensanctions.org/match/default'

interface OpenSanctionsResult {
  id: string
  caption: string
  schema: string
  properties: Record<string, string[]>
  datasets: string[]
  score: number
}

interface OpenSanctionsResponse {
  responses: Record<
    string,
    { results: OpenSanctionsResult[]; total: { value: number } }
  >
}

export const pepProvider: ScreeningProvider = {
  type: SCREENING_TYPES.PEP,

  async screen(entity: ScreeningEntity): Promise<ScreeningResult> {
    try {
      const payload = {
        queries: {
          entity_query: {
            schema: entity.type === 'individual' ? 'Person' : 'Company',
            properties: {
              name: [entity.name],
              ...(entity.jurisdiction
                ? { country: [entity.jurisdiction] }
                : {}),
            },
          },
        },
      }

      const res = await fetch(OPENSANCTIONS_MATCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      })

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error')
        return {
          type: SCREENING_TYPES.PEP,
          hits: [],
          rawData: { error: errorText },
          error: `OpenSanctions API returned ${res.status}`,
        }
      }

      const data: OpenSanctionsResponse = await res.json()
      const queryResult = data.responses?.entity_query

      if (!queryResult) {
        return {
          type: SCREENING_TYPES.PEP,
          hits: [],
          rawData: data as unknown as import('@/types/database').Json,
        }
      }

      const hits: ScreeningHit[] = queryResult.results
        .filter(
          (r) =>
            r.datasets.some((d) => d.includes('pep')) ||
            r.properties?.topics?.some((t: string) =>
              t.toLowerCase().includes('pep')
            )
        )
        .map((r) => ({
          source: 'OpenSanctions',
          matchScore: Math.round(r.score * 100),
          matchedName: r.caption,
          severity: classifySeverity(Math.round(r.score * 100)),
          data: {
            schema: r.schema,
            datasets: r.datasets,
            position: r.properties?.position?.[0] ?? null,
            country: r.properties?.country?.[0] ?? null,
            topics: r.properties?.topics ?? [],
          },
          sourceUrl: `https://opensanctions.org/entities/${r.id}/`,
        }))

      return {
        type: SCREENING_TYPES.PEP,
        hits,
        rawData: {
          total: queryResult.total.value,
          resultCount: queryResult.results.length,
          pepFilteredCount: hits.length,
        },
      }
    } catch (err) {
      return {
        type: SCREENING_TYPES.PEP,
        hits: [],
        rawData: {},
        error: err instanceof Error ? err.message : 'PEP screening failed',
      }
    }
  },
}
