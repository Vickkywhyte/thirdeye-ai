import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
    organisationName: z.string().min(2, 'Organisation name is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type RegisterInput = z.infer<typeof registerSchema>

export const resetPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type NewPasswordInput = z.infer<typeof newPasswordSchema>

export const COUNTERPARTY_TYPES = [
  'merchant',
  'partner',
  'psp',
  'vendor',
  'respondent_institution',
  'other',
] as const

export const entitySchema = z.object({
  name: z.string().min(1, 'Entity name is required'),
  type: z.enum(['individual', 'company', 'trust', 'partnership', 'other']),
  jurisdiction: z.string().optional(),
  registration_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
  counterparty_type: z.enum(COUNTERPARTY_TYPES).nullable().optional(),
})
export type EntityInput = z.infer<typeof entitySchema>
export type CounterpartyType = (typeof COUNTERPARTY_TYPES)[number]

export const investigationSchema = z.object({
  entity_id: z.string().uuid('Invalid entity ID'),
  assigned_to: z.string().uuid('Invalid user ID').optional(),
  due_date: z.string().optional(),
  summary: z.string().optional(),
})
export type InvestigationInput = z.infer<typeof investigationSchema>

export const createInvestigationSchema = z.object({
  entity_name: z.string().min(1, 'Entity name is required'),
  entity_type: z.enum(['individual', 'company', 'trust', 'partnership', 'other']),
  jurisdiction: z.string().optional(),
  registration_number: z.string().optional(),
  parent_investigation_id: z.string().uuid('Invalid parent investigation ID').optional(),
  counterparty_type: z.enum(COUNTERPARTY_TYPES).nullable().optional(),
})
export type CreateInvestigationInput = z.infer<typeof createInvestigationSchema>

export const updateInvestigationSchema = z.object({
  status: z
    .enum(['active', 'pending_review', 'completed', 'escalated', 'archived'])
    .optional(),
  assigned_to: z.string().uuid('Invalid user ID').nullable().optional(),
  summary: z.string().optional(),
  due_date: z.string().optional(),
})
export type UpdateInvestigationInput = z.infer<typeof updateInvestigationSchema>

export const timelineEventSchema = z.object({
  event_type: z.string().min(1, 'Event type is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
})
export type TimelineEventInput = z.infer<typeof timelineEventSchema>

export const analystNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required'),
})
export type AnalystNoteInput = z.infer<typeof analystNoteSchema>

export const screeningSchema = z.object({
  investigation_id: z.string().uuid('Invalid investigation ID'),
  types: z
    .array(z.enum(['sanctions', 'pep', 'adverse_media', 'registry']))
    .min(1, 'Select at least one screening type'),
})
export type ScreeningInput = z.infer<typeof screeningSchema>

export const APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'decided',
] as const

export const createApplicationSchema = z.object({
  investigation_id: z.string().uuid('Invalid investigation ID'),
  status: z.enum(['draft', 'submitted']).default('draft'),
})
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>

export const updateApplicationSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
})
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>

export const DECISION_TYPES = ['approve', 'reject', 'refer'] as const

export const createDecisionSchema = z.object({
  decision_type: z.enum(DECISION_TYPES),
  rationale: z
    .string()
    .min(20, 'Rationale must be at least 20 characters')
    .max(5000, 'Rationale is too long'),
  source_id: z.string().uuid('Invalid source ID').nullable().optional(),
})
export type CreateDecisionInput = z.infer<typeof createDecisionSchema>

export const ESCALATION_STATUSES = ['open', 'resolved'] as const

export const createEscalationSchema = z.object({
  reason: z
    .string()
    .min(20, 'Reason must be at least 20 characters')
    .max(5000, 'Reason is too long'),
  assigned_to: z.string().uuid('Invalid user ID').nullable().optional(),
  source_id: z.string().uuid('Invalid source ID').nullable().optional(),
})
export type CreateEscalationInput = z.infer<typeof createEscalationSchema>

export const resolveEscalationSchema = z.object({
  resolution_notes: z
    .string()
    .min(20, 'Resolution notes must be at least 20 characters')
    .max(5000, 'Resolution notes are too long'),
})
export type ResolveEscalationInput = z.infer<typeof resolveEscalationSchema>

export const EDD_STATUSES = ['draft', 'completed'] as const
export const EDD_RISK_LEVELS = ['low', 'medium', 'high'] as const

const riskFactorsSchema = z
  .record(z.string(), z.enum(EDD_RISK_LEVELS))
  .default({})

export const upsertEddSchema = z.object({
  status: z.enum(EDD_STATUSES).default('draft'),
  risk_factors: riskFactorsSchema,
  notes: z.string().max(10000, 'Notes are too long').nullable().optional(),
  source_id: z.string().uuid('Invalid source ID').nullable().optional(),
})
export type UpsertEddInput = z.infer<typeof upsertEddSchema>

export const updateEddSchema = z.object({
  status: z.enum(EDD_STATUSES).optional(),
  risk_factors: riskFactorsSchema.optional(),
  notes: z.string().max(10000, 'Notes are too long').nullable().optional(),
  source_id: z.string().uuid('Invalid source ID').nullable().optional(),
})
export type UpdateEddInput = z.infer<typeof updateEddSchema>

export const REVIEW_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'overdue',
] as const
export const REVIEW_DUE_PRESETS = [30, 90, 365] as const

export const createReviewSchema = z
  .object({
    due_date: z.string().datetime('due_date must be an ISO 8601 datetime').optional(),
    due_in_days: z
      .number()
      .int('due_in_days must be an integer')
      .positive('due_in_days must be positive')
      .max(3650, 'due_in_days cannot exceed 10 years')
      .optional(),
    source_id: z.string().uuid('Invalid source ID').nullable().optional(),
  })
  .refine((v) => v.due_date || v.due_in_days, {
    message: 'Either due_date or due_in_days is required',
    path: ['due_date'],
  })
export type CreateReviewInput = z.infer<typeof createReviewSchema>

export const updateReviewSchema = z
  .object({
    status: z.enum(['in_progress', 'completed']).optional(),
    due_date: z.string().datetime('due_date must be an ISO 8601 datetime').optional(),
    source_id: z.string().uuid('Invalid source ID').nullable().optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.due_date !== undefined || v.source_id !== undefined,
    { message: 'Nothing to update', path: ['status'] }
  )
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>

export const HIT_DISPOSITIONS = [
  'unreviewed',
  'confirmed',
  'false_positive',
  'needs_review',
  'unable_to_determine',
  'not_applicable',
] as const
export type HitDisposition = (typeof HIT_DISPOSITIONS)[number]

export const REVIEWABLE_HIT_DISPOSITIONS = [
  'confirmed',
  'false_positive',
  'needs_review',
  'unable_to_determine',
  'not_applicable',
] as const

export const reviewScreeningHitSchema = z.object({
  disposition: z.enum(REVIEWABLE_HIT_DISPOSITIONS),
  rationale: z
    .string()
    .min(20, 'Rationale must be at least 20 characters')
    .max(5000, 'Rationale is too long'),
})
export type ReviewScreeningHitInput = z.infer<typeof reviewScreeningHitSchema>
