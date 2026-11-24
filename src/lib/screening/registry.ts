import {
  SCREENING_TYPES,
  classifySeverity,
  type OwnershipRelation,
  type ScreeningEntity,
  type ScreeningHit,
  type ScreeningProvider,
  type ScreeningResult,
} from './types'

const CH_BASE = 'https://api.company-information.service.gov.uk'

/** Companies House rejects a request with no credentials, so surface that clearly. */
class RegistryAuthError extends Error {}

function getHeaders(): HeadersInit {
  const key = process.env.COMPANIES_HOUSE_API_KEY
  if (!key) return {}
  return { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` }
}

interface CompanySearchItem {
  company_number: string
  title: string
  company_status: string
  date_of_creation: string
  address_snippet: string
  company_type: string
}

interface CompanyProfile {
  company_number: string
  company_name: string
  company_status: string
  type: string
  date_of_creation: string
  registered_office_address: Record<string, string>
  sic_codes?: string[]
}

interface PSCEntry {
  name?: string
  name_elements?: { forename: string; surname: string }
  natures_of_control?: string[]
  kind: string
  notified_on?: string
  ceased_on?: string
  country_of_residence?: string
  nationality?: string
}

interface OfficerEntry {
  name: string
  officer_role: string
  appointed_on?: string
  resigned_on?: string
  nationality?: string
  country_of_residence?: string
  occupation?: string
}

/**
 * Single place where Companies House HTTP failures are classified. A 401 used
 * to be swallowed into an empty array, which surfaced as "0 hits" and hid a
 * bad API key entirely.
 */
async function chFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${CH_BASE}${path}`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(10000),
  })

  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '')
    throw new RegistryAuthError(
      `Companies House rejected the API key (${res.status}): ${body.trim() || 'no detail'}. ` +
        'Check COMPANIES_HOUSE_API_KEY is a live REST key (not a Streaming or sandbox key) for an activated application.'
    )
  }

  // 404 is a legitimate "no such company / no filings" answer.
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`Companies House returned ${res.status} for ${path}`)
  }

  return (await res.json()) as T
}

async function searchCompanies(name: string): Promise<CompanySearchItem[]> {
  const data = await chFetch<{ items?: CompanySearchItem[] }>(
    `/search/companies?q=${encodeURIComponent(name)}&items_per_page=10`
  )
  return data?.items ?? []
}

function getCompanyProfile(number: string): Promise<CompanyProfile | null> {
  return chFetch<CompanyProfile>(`/company/${encodeURIComponent(number)}`)
}

async function getPSCs(number: string): Promise<PSCEntry[]> {
  const data = await chFetch<{ items?: PSCEntry[] }>(
    `/company/${encodeURIComponent(number)}/persons-with-significant-control`
  )
  return data?.items ?? []
}

async function getOfficers(number: string): Promise<OfficerEntry[]> {
  const data = await chFetch<{ items?: OfficerEntry[] }>(
    `/company/${encodeURIComponent(number)}/officers`
  )
  return data?.items ?? []
}

/**
 * Companies House publishes ownership as bands, e.g.
 * "ownership-of-shares-25-to-50-percent". Return the band's lower bound.
 */
function parseOwnershipPct(naturesOfControl: string[]): number | null {
  for (const nature of naturesOfControl) {
    const band = nature.match(/(\d+)-to-(\d+)-percent/)
    if (band) return Number(band[1])
    const exact = nature.match(/(\d+)-percent/)
    if (exact) return Number(exact[1])
  }
  return null
}

function pscName(psc: PSCEntry): string {
  if (psc.name) return psc.name
  if (psc.name_elements) {
    return `${psc.name_elements.forename} ${psc.name_elements.surname}`.trim()
  }
  return 'Unknown'
}

function pscEntityType(kind: string): 'individual' | 'company' {
  return kind.includes('corporate') || kind.includes('legal-person')
    ? 'company'
    : 'individual'
}

export const registryProvider: ScreeningProvider = {
  type: SCREENING_TYPES.REGISTRY,

  async screen(entity: ScreeningEntity): Promise<ScreeningResult> {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY
    console.log('[registry] Starting registry screening for:', entity.name)
    console.log('[registry] COMPANIES_HOUSE_API_KEY configured:', !!apiKey)

    if (!apiKey) {
      console.warn('[registry] No API key — skipping')
      return {
        type: SCREENING_TYPES.REGISTRY,
        hits: [],
        rawData: {},
        error: 'COMPANIES_HOUSE_API_KEY not configured',
      }
    }

    try {
      let companyNumber: string | null = null
      let matchedTitle: string | null = null
      let searchResultCount = 0
      let resolvedBy: 'registration_number' | 'name_search' = 'name_search'

      // A registration number is an exact identifier: resolve it directly
      // rather than hoping it appears in the top 10 fuzzy name matches.
      if (entity.registration_number) {
        const direct = await getCompanyProfile(entity.registration_number)
        if (direct) {
          companyNumber = direct.company_number
          matchedTitle = direct.company_name
          resolvedBy = 'registration_number'
          console.log(
            '[registry] Resolved directly by registration number:',
            companyNumber
          )
        } else {
          console.warn(
            '[registry] Registration number not found, falling back to name search:',
            entity.registration_number
          )
        }
      }

      if (!companyNumber) {
        const companies = await searchCompanies(entity.name)
        searchResultCount = companies.length
        if (companies.length === 0) {
          return {
            type: SCREENING_TYPES.REGISTRY,
            hits: [],
            rawData: { searchResults: 0, resolvedBy: 'name_search' },
          }
        }
        const best =
          (entity.registration_number
            ? companies.find(
                (c) => c.company_number === entity.registration_number
              )
            : undefined) ?? companies[0]
        companyNumber = best.company_number
        matchedTitle = best.title
      }

      const [profile, pscs, officers] = await Promise.all([
        getCompanyProfile(companyNumber),
        getPSCs(companyNumber),
        getOfficers(companyNumber),
      ])

      const resolvedName = profile?.company_name ?? matchedTitle ?? entity.name

      // Only current appointments belong in an ownership graph.
      const activePscs = pscs.filter((p) => !p.ceased_on)
      const activeOfficers = officers.filter((o) => !o.resigned_on)

      const ownership: OwnershipRelation[] = [
        ...activePscs.map((p) => {
          const natures = p.natures_of_control ?? []
          return {
            name: pscName(p),
            kind: 'psc' as const,
            entityType: pscEntityType(p.kind),
            ownershipPct: parseOwnershipPct(natures),
            role: natures.join(', ') || null,
            nationality: p.nationality ?? null,
            countryOfResidence: p.country_of_residence ?? null,
            metadata: {
              kind: p.kind,
              naturesOfControl: natures,
              notifiedOn: p.notified_on ?? null,
            },
          }
        }),
        ...activeOfficers.map((o) => ({
          name: o.name,
          kind: 'officer' as const,
          entityType: o.officer_role?.includes('corporate')
            ? ('company' as const)
            : ('individual' as const),
          ownershipPct: null,
          role: o.officer_role ?? null,
          nationality: o.nationality ?? null,
          countryOfResidence: o.country_of_residence ?? null,
          metadata: {
            officerRole: o.officer_role,
            appointedOn: o.appointed_on ?? null,
            occupation: o.occupation ?? null,
          },
        })),
      ]

      const nameMatch =
        resolvedBy === 'registration_number' ||
        resolvedName.toLowerCase() === entity.name.toLowerCase()
          ? 95
          : 70

      const hits: ScreeningHit[] = [
        {
          source: 'UK Companies House',
          matchScore: nameMatch,
          matchedName: resolvedName,
          severity: classifySeverity(nameMatch),
          data: {
            companyNumber,
            resolvedBy,
            status: profile?.company_status ?? null,
            type: profile?.type ?? null,
            dateOfCreation: profile?.date_of_creation ?? null,
            registeredAddress: profile?.registered_office_address ?? null,
            sicCodes: profile?.sic_codes ?? [],
            pscCount: activePscs.length,
            officerCount: activeOfficers.length,
            pscs: ownership.filter((o) => o.kind === 'psc'),
            officers: ownership.filter((o) => o.kind === 'officer'),
          },
          sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`,
        },
      ]

      console.log(
        '[registry] Completed — company:',
        companyNumber,
        '| resolvedBy:',
        resolvedBy,
        '| PSCs:',
        activePscs.length,
        '| officers:',
        activeOfficers.length
      )

      return {
        type: SCREENING_TYPES.REGISTRY,
        hits,
        rawData: {
          searchResults: searchResultCount,
          matchedCompany: companyNumber,
          resolvedBy,
          pscCount: activePscs.length,
          officerCount: activeOfficers.length,
        },
        ownership,
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Registry screening failed'
      console.error('[registry] Failed:', message)
      return {
        type: SCREENING_TYPES.REGISTRY,
        hits: [],
        rawData: {},
        error: message,
      }
    }
  },
}
