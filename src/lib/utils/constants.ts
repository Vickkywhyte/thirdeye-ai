export const APP_NAME = 'ThirdEye AI' as const
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const RISK_LEVELS = {
  CRITICAL: { label: 'Critical', value: 'critical', minScore: 80, color: '#EF4444' },
  HIGH: { label: 'High', value: 'high', minScore: 60, color: '#F97316' },
  MEDIUM: { label: 'Medium', value: 'medium', minScore: 40, color: '#EAB308' },
  LOW: { label: 'Low', value: 'low', minScore: 0, color: '#22C55E' },
} as const

export type RiskLevel = keyof typeof RISK_LEVELS

export const ENTITY_TYPES = {
  INDIVIDUAL: 'individual',
  COMPANY: 'company',
  TRUST: 'trust',
  PARTNERSHIP: 'partnership',
  OTHER: 'other',
} as const

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES]

export const SCREENING_TYPES = {
  SANCTIONS: 'sanctions',
  PEP: 'pep',
  ADVERSE_MEDIA: 'adverse_media',
  REGISTRY: 'registry',
} as const

export type ScreeningType = (typeof SCREENING_TYPES)[keyof typeof SCREENING_TYPES]

export const INVESTIGATION_STATUSES = {
  ACTIVE: 'active',
  PENDING_REVIEW: 'pending_review',
  COMPLETED: 'completed',
  ESCALATED: 'escalated',
  ARCHIVED: 'archived',
} as const

export type InvestigationStatus =
  (typeof INVESTIGATION_STATUSES)[keyof typeof INVESTIGATION_STATUSES]
