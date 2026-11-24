import type { Json } from '@/types/database'

export const SCREENING_TYPES = {
  SANCTIONS: 'sanctions',
  PEP: 'pep',
  ADVERSE_MEDIA: 'adverse_media',
  REGISTRY: 'registry',
} as const

export type ScreeningTypeValue =
  (typeof SCREENING_TYPES)[keyof typeof SCREENING_TYPES]

export const HIT_SEVERITY = {
  CONFIRMED: 'confirmed',
  POSSIBLE: 'possible',
  WEAK: 'weak',
} as const

export type HitSeverity = (typeof HIT_SEVERITY)[keyof typeof HIT_SEVERITY]

export interface ScreeningEntity {
  name: string
  type: string
  jurisdiction?: string | null
  registration_number?: string | null
  date_of_birth?: string | null
}

export interface ScreeningHit {
  source: string
  matchScore: number
  matchedName: string | null
  severity: HitSeverity
  data: Record<string, unknown>
  sourceUrl?: string
}

/**
 * A control/ownership relationship discovered in a company registry.
 * Providers return these so the orchestrator can persist them as graph edges.
 */
export interface OwnershipRelation {
  name: string
  /** psc = person with significant control; officer = director/secretary. */
  kind: 'psc' | 'officer'
  entityType: 'individual' | 'company'
  /**
   * Lower bound of the declared ownership band, when the registry publishes
   * one. Registries report bands ("25 to 50 percent"), not exact figures, so
   * the floor is stored and the raw band is kept in metadata.
   */
  ownershipPct?: number | null
  role?: string | null
  nationality?: string | null
  countryOfResidence?: string | null
  metadata?: Record<string, unknown>
}

export interface ScreeningResult {
  type: ScreeningTypeValue
  hits: ScreeningHit[]
  rawData: Json | Record<string, unknown>
  error?: string
  /** Graph relationships to persist (currently only the registry provider). */
  ownership?: OwnershipRelation[]
}

export interface ScreeningProvider {
  type: ScreeningTypeValue
  screen(entity: ScreeningEntity): Promise<ScreeningResult>
}

export function classifySeverity(score: number): HitSeverity {
  if (score >= 85) return HIT_SEVERITY.CONFIRMED
  if (score >= 60) return HIT_SEVERITY.POSSIBLE
  return HIT_SEVERITY.WEAK
}

/** Screening types that make sense for an individual (KYC) subject. */
export const INDIVIDUAL_SCREENING_TYPES: ScreeningTypeValue[] = [
  SCREENING_TYPES.SANCTIONS,
  SCREENING_TYPES.PEP,
  SCREENING_TYPES.ADVERSE_MEDIA,
]

/**
 * Drop checks that can't apply to the subject. The registry provider queries
 * company registries (Companies House), so it is meaningless for a natural
 * person and would otherwise sit at "pending" forever.
 */
export function applicableScreeningTypes(
  entityType: string,
  requested: ScreeningTypeValue[]
): ScreeningTypeValue[] {
  if (entityType === 'individual') {
    return requested.filter((t) => t !== SCREENING_TYPES.REGISTRY)
  }
  return requested
}
