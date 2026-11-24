import {
  SCREENING_TYPES,
  classifySeverity,
  type ScreeningEntity,
  type ScreeningHit,
  type ScreeningProvider,
  type ScreeningResult,
} from './types'
import { generateCompletion } from '@/lib/ai/provider'

const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc'

// Max articles we pass to the AI classifier — keep it cheap and fast
const AI_CLASSIFICATION_LIMIT = 8

const CORPORATE_SUFFIXES = new Set([
  'limited', 'ltd', 'plc', 'llc', 'inc', 'corp', 'corporation', 'incorporated',
  'gmbh', 'bv', 'nv', 'sa', 'ag', 'se', 'lp', 'llp',
  'group', 'holdings', 'holding', 'partners', 'associates',
  'services', 'solutions', 'technologies', 'systems', 'international',
  'global', 'uk', 'europe', 'us', 'utilities', 'ventures',
])

/** Strip trailing corporate/legal suffixes so "Thames Water Utilities Limited" → "Thames Water". */
function stripCorporateSuffixes(name: string): string {
  const parts = name.trim().split(/\s+/)
  while (parts.length > 1) {
    const last = parts[parts.length - 1].toLowerCase().replace(/[.,]$/, '')
    if (CORPORATE_SUFFIXES.has(last)) {
      parts.pop()
    } else {
      break
    }
  }
  return parts.join(' ')
}

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

interface AiClassification {
  riskLevel: 'Low' | 'Medium' | 'High'
  summary: string
}

/** GDELT query: use cleaned name + broad compliance keywords for maximum recall. */
function buildGdeltQuery(cleanName: string): string {
  return `"${cleanName}" (fraud OR corruption OR fine OR investigation OR bankrupt OR collapse OR scandal OR sanction)`
}

async function fetchGDELT(cleanName: string): Promise<GdeltArticle[]> {
  try {
    const query = encodeURIComponent(buildGdeltQuery(cleanName))
    const url = `${GDELT_DOC_API}?query=${query}&mode=artlist&maxrecords=50&format=json&sort=datedesc`

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []

    const data = await res.json()
    return (data.articles ?? []) as GdeltArticle[]
  } catch {
    return []
  }
}

async function fetchNewsAPI(cleanName: string): Promise<ScreeningHit[]> {
  const apiKey = process.env.NEWSAPI_API_KEY
  if (!apiKey) return []

  try {
    const negTerms = ['fraud', 'corruption', 'money laundering', 'bribery', 'sanctions']
      .slice(0, 3)
      .join(' OR ')
    const query = encodeURIComponent(`"${cleanName}" AND (${negTerms})`)
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
      matchScore: 60,
      matchedName: null,
      severity: classifySeverity(60),
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

/** Call AI to classify the risk level based on the top articles. */
async function classifyWithAI(
  entityName: string,
  articles: GdeltArticle[]
): Promise<AiClassification> {
  const topArticles = articles.slice(0, AI_CLASSIFICATION_LIMIT)

  const articleList = topArticles
    .map((a, i) => `${i + 1}. "${a.title}" — ${a.domain} (tone: ${a.tone?.toFixed(1) ?? 'n/a'})`)
    .join('\n')

  const prompt =
    `You are a compliance analyst reviewing adverse media for a due diligence report.\n\n` +
    `Company: ${entityName}\n\n` +
    `News headlines from GDELT:\n${articleList}\n\n` +
    `Classify the overall adverse media risk as Low, Medium, or High.\n` +
    `- If Medium or High: identify the most concerning article and explain the specific risk (money laundering, fraud, sanctions evasion, etc.).\n` +
    `- If Low: reply only with "No material adverse media found."\n\n` +
    `Format your answer as:\nRisk: <Low|Medium|High>\nSummary: <one or two sentences>`

  try {
    const result = await generateCompletion(prompt, {
      maxTokens: 200,
      temperature: 0.1,
      systemPrompt: 'You are a strict compliance analyst. Be concise and factual.',
    })

    const text = result.text.trim()
    const riskMatch = text.match(/Risk:\s*(Low|Medium|High)/i)
    const summaryMatch = text.match(/Summary:\s*([\s\S]+)/i)

    const riskLevel = (riskMatch?.[1] ?? 'Low') as 'Low' | 'Medium' | 'High'
    const summary = summaryMatch?.[1]?.trim() ?? 'No material adverse media found.'

    return { riskLevel, summary }
  } catch {
    // AI unavailable — fall back to tone-based heuristic
    const hasNegativeTone = topArticles.some((a) => (a.tone ?? 0) < -5)
    return {
      riskLevel: hasNegativeTone ? 'Medium' : 'Low',
      summary: hasNegativeTone
        ? 'AI classification unavailable. Articles with strongly negative tone detected.'
        : 'AI classification unavailable. No strongly negative articles detected.',
    }
  }
}

function gdeltArticleToHit(article: GdeltArticle, aiSummary?: string): ScreeningHit {
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
      ...(aiSummary ? { aiSummary } : {}),
    },
    sourceUrl: article.url,
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
    console.log('[adverse_media] Starting adverse media screening for:', entity.name)

    try {
      const cleanName = stripCorporateSuffixes(entity.name)
      console.log('[adverse_media] Clean name:', cleanName, '(original:', entity.name, ')')

      // 1. Fetch GDELT (primary) and NewsAPI (secondary) in parallel
      const [gdeltArticles, newsHitsSettled] = await Promise.allSettled([
        fetchGDELT(cleanName),
        fetchNewsAPI(cleanName),
      ])

      const articles = gdeltArticles.status === 'fulfilled' ? gdeltArticles.value : []
      const newsHits = newsHitsSettled.status === 'fulfilled' ? newsHitsSettled.value : []

      console.log('[adverse_media] GDELT articles:', articles.length, '| NewsAPI hits:', newsHits.length)

      // 2. Run AI classification on top GDELT articles (non-blocking — degrade gracefully)
      let classification: AiClassification = { riskLevel: 'Low', summary: 'No material adverse media found.' }
      if (articles.length > 0) {
        classification = await classifyWithAI(cleanName, articles)
        console.log('[adverse_media] AI classification:', classification.riskLevel)
      }

      // 3. Convert GDELT articles to hits, attaching AI summary to the top result
      const gdeltHits = articles.map((article, i) =>
        gdeltArticleToHit(article, i === 0 ? classification.summary : undefined)
      )

      const allHits = [...gdeltHits, ...newsHits]
      const deduplicated = deduplicateByUrl(allHits).sort(
        (a, b) => b.matchScore - a.matchScore
      )

      console.log('[adverse_media] Completed — total hits:', deduplicated.length, '| AI risk:', classification.riskLevel)

      return {
        type: SCREENING_TYPES.ADVERSE_MEDIA,
        hits: deduplicated,
        rawData: {
          gdeltCount: articles.length,
          newsApiCount: newsHits.length,
          deduplicatedCount: deduplicated.length,
          aiRiskLevel: classification.riskLevel,
          aiSummary: classification.summary,
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
