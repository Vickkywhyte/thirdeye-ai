import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createEscalationSchema } from '@/lib/validation/schemas'
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

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'escalations:create')) return apiForbidden()

    const { id: investigationId } = await params
    validateUUID(investigationId)

    const body = await request.json()
    const parsed = createEscalationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()

    const { data: investigation, error: invError } = await supabase
      .from('investigations')
      .select('id, status')
      .eq('id', investigationId)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (invError) return apiError(invError.message, 500, 'DB_ERROR')
    if (!investigation) return apiNotFound('Investigation not found')

    const { data: escalation, error } = await supabase
      .from('escalations')
      .insert({
        org_id: user.orgId,
        investigation_id: investigationId,
        escalated_by: user.id,
        assigned_to: parsed.data.assigned_to ?? null,
        reason: parsed.data.reason,
        source_id: parsed.data.source_id ?? null,
      })
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    if (investigation.status !== 'escalated') {
      await supabase
        .from('investigations')
        .update({ status: 'escalated' })
        .eq('id', investigationId)
        .eq('org_id', user.orgId)
    }

    await supabase.from('timeline_events').insert({
      investigation_id: investigationId,
      event_type: 'escalation_created',
      title: 'Escalation opened',
      description: parsed.data.reason.slice(0, 500),
      created_by: user.id,
      data: {
        escalationId: escalation.id,
        assignedTo: parsed.data.assigned_to ?? null,
      },
    })

    await logAuditEvent(supabase as never, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.ESCALATION_CREATED,
      resourceType: 'escalation',
      resourceId: escalation.id,
      metadata: {
        investigationId,
        assignedTo: parsed.data.assigned_to ?? null,
      },
    })

    return apiCreated(escalation)
  } catch (error) {
    return handleApiError(error)
  }
}
