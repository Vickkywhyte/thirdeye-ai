import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { updateReviewSchema } from '@/lib/validation/schemas'
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiError,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { validateUUID } from '@/lib/security/input-validator'
import { logAuditEvent, AUDIT_ACTIONS } from '@/lib/security/audit'
import type { Database } from '@/types/database'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:read')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (error) return apiError(error.message, 500, 'DB_ERROR')
    if (!data) return apiNotFound('Review not found')

    return apiSuccess(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:update')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const body = await request.json()
    const parsed = updateReviewSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('reviews')
      .select('id, investigation_id, status')
      .eq('id', id)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (existingError) return apiError(existingError.message, 500, 'DB_ERROR')
    if (!existing) return apiNotFound('Review not found')

    const completing =
      parsed.data.status === 'completed' && existing.status !== 'completed'

    const update: Database['public']['Tables']['reviews']['Update'] = {}
    if (parsed.data.status !== undefined) update.status = parsed.data.status
    if (parsed.data.due_date !== undefined) update.due_date = parsed.data.due_date
    if (parsed.data.source_id !== undefined) update.source_id = parsed.data.source_id
    if (completing) {
      update.completed_by = user.id
      update.completed_at = new Date().toISOString()
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .update(update)
      .eq('id', id)
      .eq('org_id', user.orgId)
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    if (completing) {
      await supabase.from('timeline_events').insert({
        investigation_id: existing.investigation_id,
        event_type: 'review_completed',
        title: 'Periodic review completed',
        description: null,
        created_by: user.id,
        data: { reviewId: id },
      })
      await logAuditEvent(supabase as never, {
        userId: user.id,
        orgId: user.orgId,
        action: AUDIT_ACTIONS.REVIEW_COMPLETED,
        resourceType: 'review',
        resourceId: id,
        metadata: { investigationId: existing.investigation_id },
      })
    }

    return apiSuccess(review)
  } catch (error) {
    return handleApiError(error)
  }
}
