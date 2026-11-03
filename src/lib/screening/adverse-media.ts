import {
  SCREENING_TYPES,
  classifySeverity,
  type ScreeningEntity,
  type ScreeningHit,
  type ScreeningProvider,
  type ScreeningResult,
} from './types'

const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc'

const NEGATIVE_KEYWORDS = [
  'fraud',
  'corruption',
  'money laundering',
  'sanctions',
  'bribery',
  'embezzlement',
  'tax evasion',
  'criminal',
  'indicted',
  'convicted',
]

interface GdeltArticle {
  url: string
  title: string
  seendate: string
  domain: string
  socialimage?: string
  tone?: number
}

interface NewsApiArticle {
  url: string
  title: string
  publishedAt: string
  source: { name: string }
  description: string | null
}

function buildGdeltQuery(entityName: string): string {
  const negTerms = NEGATIVE_KEYWORDS.slice(0, 5).join(' OR ')
  return `"${entityName}" (${negTerms})`
}

async function fetchGDELT(entityName: string): Promise<ScreeningHit[]> {
  try {
    const query = encodeURIComponent(buildGdeltQuery(entityName))
    const url = `${GDELT_DOC_API}?query=${query}&mode=artlist&maxrecords=50&format=json&sort=datedesc`

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []

    const data = await res.json()
    const articles: GdeltArticle[] = data.articles ?? []

    return articles.map((article) => {
      const tone = article.tone ?? 0
      const score = Math.min(95, Math.max(30, 60 + Math.abs(tone) * 3))

      return {
        source: 'GDELT',
        matchScore: Math.round(score),
        matchedName: null,
        severity: classifySeverity(Math.round(score)),
        data: {
          headline: article.title,
          url: article.url,
          date: article.seendate,
          domain: article.domain,
          tone: article.tone,
        },
        sourceUrl: article.url,
      }
    })
  } catch {
    return []
  }
}

async function fetchNewsAPI(entityName: string): Promise<ScreeningHit[]> {
  const apiKey = process.env.NEWSAPI_API_KEY
  if (!apiKey) return []

  try {
    const negTerms = NEGATIVE_KEYWORDS.slice(0, 3).join(' OR ')
    const query = encodeURIComponent(`"${entityName}" AND (${negTerms})`)
    const url = `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=20&language=en`

    const res = await fetch(url, {
      headers: { 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []

    const data = await res.json()
    const articles: NewsApiArticle[] = data.articles ?? []

    return articles.map((article) => ({
      source: 'NewsAPI',
      matchScore: 65,
      matchedName: null,
      severity: classifySeverity(65),
      data: {
        headline: article.title,
        url: article.url,
        date: article.publishedAt,
        domain: article.source.name,
        description: article.description,
      },
      sourceUrl: article.url,
    }))
  } catch {
    return []
  }
}

function deduplicateByUrl(hits: ScreeningHit[]): ScreeningHit[] {
  const seen = new Set<string>()
  return hits.filter((hit) => {
    const url = hit.sourceUrl ?? hit.data.url
    if (typeof url !== 'string' || !url) return true
    if (seen.has(url)) return false
    seen.add(url)
    return true
  })
}

export const adverseMediaProvider: ScreeningProvider = {
  type: SCREENING_TYPES.ADVERSE_MEDIA,

  async screen(entity: ScreeningEntity): Promise<ScreeningResult> {
    try {
      const [gdeltHits, newsHits] = await Promise.allSettled([
        fetchGDELT(entity.name),
        fetchNewsAPI(entity.name),
      ])

      const allHits = [
        ...(gdeltHits.status === 'fulfilled' ? gdeltHits.value : []),
        ...(newsHits.status === 'fulfilled' ? newsHits.value : []),
      ]

      const deduplicated = deduplicateByUrl(allHits).sort(
        (a, b) => b.matchScore - a.matchScore
      )

      return {
        type: SCREENING_TYPES.ADVERSE_MEDIA,
        hits: deduplicated,
        rawData: {
          gdeltCount:
            gdeltHits.status === 'fulfilled' ? gdeltHits.value.length : 0,
          newsApiCount:
            newsHits.status === 'fulfilled' ? newsHits.value.length : 0,
          deduplicatedCount: deduplicated.length,
        },
      }
    } catch (err) {
      return {
        type: SCREENING_TYPES.ADVERSE_MEDIA,
        hits: [],
        rawData: {},
        error:
          err instanceof Error
            ? err.message
            : 'Adverse media screening failed',
      }
    }
  },
}
