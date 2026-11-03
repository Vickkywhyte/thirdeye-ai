import {
  SCREENING_TYPES,
  classifySeverity,
  type ScreeningEntity,
  type ScreeningHit,
  type ScreeningProvider,
  type ScreeningResult,
} from './types'

const OFAC_SDN_URL = 'https://www.treasury.gov/ofac/downloads/sdn.xml'
const EU_SANCTIONS_URL =
  'https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList/content'
const UN_SANCTIONS_URL =
  'https://scsanctions.un.org/resources/xml/en/consolidated.xml'

interface SanctionsListEntry {
  source: string
  name: string
  aliases: string[]
  listType: string
  data: Record<string, unknown>
}

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function trigramSimilarity(a: string, b: string): number {
  const na = normalise(a)
  const nb = normalise(b)
  if (na === nb) return 100

  const trigramsA = new Set<string>()
  const trigramsB = new Set<string>()

  const padA = `  ${na} `
  const padB = `  ${nb} `

  for (let i = 0; i < padA.length - 2; i++) trigramsA.add(padA.slice(i, i + 3))
  for (let i = 0; i < padB.length - 2; i++) trigramsB.add(padB.slice(i, i + 3))

  let intersection = 0
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++
  }

  const union = trigramsA.size + trigramsB.size - intersection
  return union === 0 ? 0 : Math.round((intersection / union) * 100)
}

function matchAgainstList(
  entity: ScreeningEntity,
  entries: SanctionsListEntry[],
  threshold = 50
): ScreeningHit[] {
  const hits: ScreeningHit[] = []

  for (const entry of entries) {
    const names = [entry.name, ...entry.aliases]
    let bestScore = 0
    let bestName = entry.name

    for (const name of names) {
      const score = trigramSimilarity(entity.name, name)
      if (score > bestScore) {
        bestScore = score
        bestName = name
      }
    }

    if (bestScore >= threshold) {
      hits.push({
        source: entry.source,
        matchScore: bestScore,
        matchedName: bestName,
        severity: classifySeverity(bestScore),
        data: {
          listType: entry.listType,
          ...entry.data,
        },
      })
    }
  }

  return hits.sort((a, b) => b.matchScore - a.matchScore)
}

async function fetchOFAC(): Promise<SanctionsListEntry[]> {
  try {
    const res = await fetch(OFAC_SDN_URL, {
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const text = await res.text()

    const entries: SanctionsListEntry[] = []
    const sdnRegex =
      /<sdnEntry>[\s\S]*?<lastName>(.*?)<\/lastName>[\s\S]*?(?:<firstName>(.*?)<\/firstName>)?[\s\S]*?<\/sdnEntry>/g
    let match

    while ((match = sdnRegex.exec(text)) !== null) {
      const lastName = match[1] ?? ''
      const firstName = match[2] ?? ''
      const fullName = firstName ? `${firstName} ${lastName}` : lastName

      const aliases: string[] = []
      const aliasRegex = /<aka>[\s\S]*?<lastName>(.*?)<\/lastName>[\s\S]*?(?:<firstName>(.*?)<\/firstName>)?[\s\S]*?<\/aka>/g
      const entryText = match[0]
      let aliasMatch
      while ((aliasMatch = aliasRegex.exec(entryText)) !== null) {
        const aLast = aliasMatch[1] ?? ''
        const aFirst = aliasMatch[2] ?? ''
        aliases.push(aFirst ? `${aFirst} ${aLast}` : aLast)
      }

      entries.push({
        source: 'OFAC SDN',
        name: fullName,
        aliases,
        listType: 'sanctions',
        data: { program: 'OFAC SDN' },
      })
    }

    return entries
  } catch {
    return []
  }
}

async function fetchEU(): Promise<SanctionsListEntry[]> {
  try {
    const res = await fetch(EU_SANCTIONS_URL, {
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const text = await res.text()

    const entries: SanctionsListEntry[] = []
    const lines = text.split('\n').slice(1)

    for (const line of lines) {
      const cols = line.split(';')
      if (cols.length < 2) continue
      const name = (cols[1] ?? '').replace(/"/g, '').trim()
      if (!name) continue

      entries.push({
        source: 'EU Consolidated',
        name,
        aliases: [],
        listType: 'sanctions',
        data: { program: 'EU Consolidated Sanctions' },
      })
    }

    return entries
  } catch {
    return []
  }
}

async function fetchUN(): Promise<SanctionsListEntry[]> {
  try {
    const res = await fetch(UN_SANCTIONS_URL, {
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const text = await res.text()

    const entries: SanctionsListEntry[] = []
    const entityRegex =
      /<INDIVIDUAL>[\s\S]*?<FIRST_NAME>(.*?)<\/FIRST_NAME>[\s\S]*?<SECOND_NAME>(.*?)<\/SECOND_NAME>[\s\S]*?<\/INDIVIDUAL>/g
    let match

    while ((match = entityRegex.exec(text)) !== null) {
      const first = match[1] ?? ''
      const second = match[2] ?? ''
      entries.push({
        source: 'UN Security Council',
        name: `${first} ${second}`.trim(),
        aliases: [],
        listType: 'sanctions',
        data: { program: 'UN Security Council' },
      })
    }

    return entries
  } catch {
    return []
  }
}

export const sanctionsProvider: ScreeningProvider = {
  type: SCREENING_TYPES.SANCTIONS,

  async screen(entity: ScreeningEntity): Promise<ScreeningResult> {
    const [ofac, eu, un] = await Promise.allSettled([
      fetchOFAC(),
      fetchEU(),
      fetchUN(),
    ])

    const allEntries: SanctionsListEntry[] = [
      ...(ofac.status === 'fulfilled' ? ofac.value : []),
      ...(eu.status === 'fulfilled' ? eu.value : []),
      ...(un.status === 'fulfilled' ? un.value : []),
    ]

    const sourceCounts = {
      ofac: ofac.status === 'fulfilled' ? ofac.value.length : 0,
      eu: eu.status === 'fulfilled' ? eu.value.length : 0,
      un: un.status === 'fulfilled' ? un.value.length : 0,
    }

    const hits = matchAgainstList(entity, allEntries)

    return {
      type: SCREENING_TYPES.SANCTIONS,
      hits,
      rawData: { sourceCounts, totalEntries: allEntries.length },
    }
  },
}
