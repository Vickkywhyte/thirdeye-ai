import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { updateInvestigationSchema } from '@/lib/validation/schemas'
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
    if (!hasPermission(user.role, 'investigations:read')) return apiForbidden()

    const { id } = await params
    validateUUID(id)
    const supabase = await createClient()

    const { data: investigation, error: invError } = await supabase
      .from('investigations')
      .select('*')
      .eq('id', id)
      .eq('org_id', user.orgId)
      .single()

    if (invError || !investigation) return apiNotFound('Investigation not found')

    const admin = createAdminClient()

    const [entityRes, screeningRes, timelineRes] = await Promise.all([
      admin
        .from('entities')
        .select('*')
        .eq('id', investigation.entity_id)
        .single(),
      admin
        .from('screening_results')
        .select('*')
        .eq('investigation_id', id)
        .order('created_at', { ascending: true }),
      admin
        .from('timeline_events')
        .select('*')
        .eq('investigation_id', id)
        .order('created_at', { ascending: false }),
    ])

    return apiSuccess({
      ...investigation,
      entity: entityRes.data,
      screening_results: screeningRes.data ?? [],
      timeline_events: timelineRes.data ?? [],
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:update'))
      return apiForbidden()

    const { id } = await params
    validateUUID(id)
    const body = await request.json()
    const parsed = updateInvestigationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('investigations')
      .update(parsed.data)
      .eq('id', id)
      .eq('org_id', user.orgId)
      .select()
      .single()

    if (error || !data) return apiNotFound('Investigation not found')

    if (parsed.data.status) {
      await supabase.from('timeline_events').insert({
        investigation_id: id,
        event_type: 'status_changed',
        title: `Status changed to ${parsed.data.status.replace('_', ' ')}`,
        created_by: user.id,
      })
    }

    return apiSuccess(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:delete'))
      return apiForbidden()

    const { id } = await params
    validateUUID(id)
    const supabase = await createClient()

    const { error } = await supabase
      .from('investigations')
      .delete()
      .eq('id', id)
      .eq('org_id', user.orgId)

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    await logAuditEvent(supabase as never, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.INVESTIGATION_DELETED,
      resourceType: 'investigation',
      resourceId: id,
    })

    return apiSuccess({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
