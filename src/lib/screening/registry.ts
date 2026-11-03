import {
  SCREENING_TYPES,
  classifySeverity,
  type ScreeningEntity,
  type ScreeningHit,
  type ScreeningProvider,
  type ScreeningResult,
} from './types'

const CH_BASE = 'https://api.company-information.service.gov.uk'

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
  natures_of_control: string[]
  kind: string
  notified_on: string
  country_of_residence?: string
  nationality?: string
}

async function searchCompanies(
  name: string
): Promise<CompanySearchItem[]> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY
  if (!apiKey) return []

  try {
    const url = `${CH_BASE}/search/companies?q=${encodeURIComponent(name)}&items_per_page=10`
    const res = await fetch(url, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.items ?? []
  } catch {
    return []
  }
}

async function getCompanyProfile(
  number: string
): Promise<CompanyProfile | null> {
  try {
    const res = await fetch(`${CH_BASE}/company/${number}`, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function getPSCs(number: string): Promise<PSCEntry[]> {
  try {
    const res = await fetch(
      `${CH_BASE}/company/${number}/persons-with-significant-control`,
      {
        headers: getHeaders(),
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.items ?? []
  } catch {
    return []
  }
}

export const registryProvider: ScreeningProvider = {
  type: SCREENING_TYPES.REGISTRY,

  async screen(entity: ScreeningEntity): Promise<ScreeningResult> {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY
    if (!apiKey) {
      return {
        type: SCREENING_TYPES.REGISTRY,
        hits: [],
        rawData: {},
        error: 'COMPANIES_HOUSE_API_KEY not configured',
      }
    }

    try {
      const companies = await searchCompanies(entity.name)
      if (companies.length === 0) {
        return {
          type: SCREENING_TYPES.REGISTRY,
          hits: [],
          rawData: { searchResults: 0 },
        }
      }

      const hits: ScreeningHit[] = []

      const bestMatch =
        entity.registration_number
          ? companies.find(
              (c) => c.company_number === entity.registration_number
            ) ?? companies[0]
          : companies[0]

      const profile = await getCompanyProfile(bestMatch.company_number)
      const pscs = await getPSCs(bestMatch.company_number)

      const nameMatch =
        bestMatch.title.toLowerCase() === entity.name.toLowerCase() ? 95 : 70

      hits.push({
        source: 'UK Companies House',
        matchScore: nameMatch,
        matchedName: bestMatch.title,
        severity: classifySeverity(nameMatch),
        data: {
          companyNumber: bestMatch.company_number,
          status: profile?.company_status ?? bestMatch.company_status,
          type: profile?.type ?? bestMatch.company_type,
          dateOfCreation:
            profile?.date_of_creation ?? bestMatch.date_of_creation,
          registeredAddress: profile?.registered_office_address ?? null,
          sicCodes: profile?.sic_codes ?? [],
          pscs: pscs.map((p) => ({
            name:
              p.name ??
              (p.name_elements
                ? `${p.name_elements.forename} ${p.name_elements.surname}`
                : 'Unknown'),
            naturesOfControl: p.natures_of_control,
            kind: p.kind,
            notifiedOn: p.notified_on,
            countryOfResidence: p.country_of_residence,
            nationality: p.nationality,
          })),
        },
        sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${bestMatch.company_number}`,
      })

      return {
        type: SCREENING_TYPES.REGISTRY,
        hits,
        rawData: {
          searchResults: companies.length,
          matchedCompany: bestMatch.company_number,
          pscCount: pscs.length,
        },
      }
    } catch (err) {
      return {
        type: SCREENING_TYPES.REGISTRY,
        hits: [],
        rawData: {},
        error:
          err instanceof Error
            ? err.message
            : 'Registry screening failed',
      }
    }
  },
}
