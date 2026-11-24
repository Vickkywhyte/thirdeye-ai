import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { resolveEscalationSchema } from '@/lib/validation/schemas'
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
    const canCreate = hasPermission(user.role, 'escalations:create')
    const canResolve = hasPermission(user.role, 'escalations:resolve')
    if (!canCreate && !canResolve) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('escalations')
      .select('*')
      .eq('id', id)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (error) return apiError(error.message, 500, 'DB_ERROR')
    if (!data) return apiNotFound('Escalation not found')

    return apiSuccess(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'escalations:resolve')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const body = await request.json()
    const parsed = resolveEscalationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('escalations')
      .select('id, investigation_id, status')
      .eq('id', id)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (existingError) return apiError(existingError.message, 500, 'DB_ERROR')
    if (!existing) return apiNotFound('Escalation not found')
    if (existing.status === 'resolved') {
      return apiError('Escalation is already resolved', 400, 'ALREADY_RESOLVED')
    }

    const resolvedAt = new Date().toISOString()

    const { data: escalation, error } = await supabase
      .from('escalations')
      .update({
        status: 'resolved',
        resolution_notes: parsed.data.resolution_notes,
        resolved_at: resolvedAt,
      })
      .eq('id', id)
      .eq('org_id', user.orgId)
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    await supabase.from('timeline_events').insert({
      investigation_id: existing.investigation_id,
      event_type: 'escalation_resolved',
      title: 'Escalation resolved',
      description: parsed.data.resolution_notes.slice(0, 500),
      created_by: user.id,
      data: { escalationId: id },
    })

    await logAuditEvent(supabase as never, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.ESCALATION_RESOLVED,
      resourceType: 'escalation',
      resourceId: id,
      metadata: { investigationId: existing.investigation_id },
    })

    return apiSuccess(escalation)
  } catch (error) {
    return handleApiError(error)
  }
}
