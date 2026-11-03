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

export interface ScreeningResult {
  type: ScreeningTypeValue
  hits: ScreeningHit[]
  rawData: Json | Record<string, unknown>
  error?: string
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
