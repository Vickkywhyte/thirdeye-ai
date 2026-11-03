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

export const entitySchema = z.object({
  name: z.string().min(1, 'Entity name is required'),
  type: z.enum(['individual', 'company', 'trust', 'partnership', 'other']),
  jurisdiction: z.string().optional(),
  registration_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
})
export type EntityInput = z.infer<typeof entitySchema>

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
