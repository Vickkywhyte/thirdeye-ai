import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createReviewSchema } from '@/lib/validation/schemas'
import {
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiError,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { validateUUID } from '@/lib/security/input-validator'
import { logAuditEvent, AUDIT_ACTIONS } from '@/lib/security/audit'

type RouteParams = { params: Promise<{ id: string }> }

function computeDueDate(input: { due_date?: string; due_in_days?: number }): string {
  if (input.due_date) return input.due_date
  const days = input.due_in_days ?? 90
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:update')) return apiForbidden()

    const { id: investigationId } = await params
    validateUUID(investigationId)

    const body = await request.json()
    const parsed = createReviewSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()

    const { data: investigation, error: invError } = await supabase
      .from('investigations')
      .select('id')
      .eq('id', investigationId)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (invError) return apiError(invError.message, 500, 'DB_ERROR')
    if (!investigation) return apiNotFound('Investigation not found')

    const dueDate = computeDueDate(parsed.data)

    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        org_id: user.orgId,
        investigation_id: investigationId,
        status: 'pending',
        due_date: dueDate,
        source_id: parsed.data.source_id ?? null,
      })
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    await supabase.from('timeline_events').insert({
      investigation_id: investigationId,
      event_type: 'review_scheduled',
      title: 'Periodic review scheduled',
      description: `Due ${new Date(dueDate).toISOString().slice(0, 10)}`,
      created_by: user.id,
      data: { reviewId: review.id, dueDate },
    })

    await logAuditEvent(supabase as never, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.REVIEW_SCHEDULED,
      resourceType: 'review',
      resourceId: review.id,
      metadata: { investigationId, dueDate },
    })

    return apiCreated(review)
  } catch (error) {
    return handleApiError(error)
  }
}
