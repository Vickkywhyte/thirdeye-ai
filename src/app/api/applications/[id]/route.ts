import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { updateApplicationSchema } from '@/lib/validation/schemas'
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

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'applications:read')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('applications')
      .select(
        '*, investigation:investigations!inner(id, entity_id, status, risk_score)'
      )
      .eq('id', id)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (error) return apiError(error.message, 500, 'DB_ERROR')
    if (!data) return apiNotFound('Application not found')

    return apiSuccess(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'applications:update')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const body = await request.json()
    const parsed = updateApplicationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('applications')
      .select('id, status, submitted_at')
      .eq('id', id)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (existingError) return apiError(existingError.message, 500, 'DB_ERROR')
    if (!existing) return apiNotFound('Application not found')

    const update: {
      status: (typeof parsed.data)['status']
      submitted_at?: string
    } = { status: parsed.data.status }

    if (parsed.data.status === 'submitted' && !existing.submitted_at) {
      update.submitted_at = new Date().toISOString()
    }

    const { data: application, error } = await supabase
      .from('applications')
      .update(update)
      .eq('id', id)
      .eq('org_id', user.orgId)
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    await logAuditEvent(supabase as never, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.APPLICATION_UPDATED,
      resourceType: 'application',
      resourceId: id,
      metadata: {
        fromStatus: existing.status,
        toStatus: parsed.data.status,
      },
    })

    return apiSuccess(application)
  } catch (error) {
    return handleApiError(error)
  }
}
