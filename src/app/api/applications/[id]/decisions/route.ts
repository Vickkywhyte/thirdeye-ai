import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createDecisionSchema } from '@/lib/validation/schemas'
import {
  apiSuccess,
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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'decisions:read')) return apiForbidden()

    const { id: applicationId } = await params
    validateUUID(applicationId)

    const supabase = await createClient()

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('id', applicationId)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (appError) return apiError(appError.message, 500, 'DB_ERROR')
    if (!application) return apiNotFound('Application not found')

    const { data, error } = await supabase
      .from('decisions')
      .select('*')
      .eq('application_id', applicationId)
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false })

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiSuccess({ decisions: data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'decisions:create')) return apiForbidden()

    const { id: applicationId } = await params
    validateUUID(applicationId)

    const body = await request.json()
    const parsed = createDecisionSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, investigation_id, status')
      .eq('id', applicationId)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (appError) return apiError(appError.message, 500, 'DB_ERROR')
    if (!application) return apiNotFound('Application not found')

    // Provenance (D1): verify the cited source belongs to the caller's org
    // before trusting its FK. RLS would block cross-tenant reads, but the
    // FK insert itself would otherwise succeed and attribute the decision
    // to someone else's record.
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('id')
      .eq('id', parsed.data.source_id)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (sourceError) return apiError(sourceError.message, 500, 'DB_ERROR')
    if (!source) {
      return apiError(
        'Source not found in this organisation',
        400,
        'INVALID_SOURCE'
      )
    }

    const { data: decision, error } = await supabase
      .from('decisions')
      .insert({
        org_id: user.orgId,
        application_id: applicationId,
        decision_type: parsed.data.decision_type,
        rationale: parsed.data.rationale,
        decided_by: user.id,
        source_id: parsed.data.source_id,
      })
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    const { error: updateError } = await supabase
      .from('applications')
      .update({ status: 'decided' })
      .eq('id', applicationId)
      .eq('org_id', user.orgId)

    if (updateError) return apiError(updateError.message, 500, 'DB_ERROR')

    await supabase.from('timeline_events').insert({
      investigation_id: application.investigation_id,
      event_type: 'decision_recorded',
      title: `Decision: ${parsed.data.decision_type}`,
      description: parsed.data.rationale.slice(0, 500),
      created_by: user.id,
      data: {
        applicationId,
        decisionId: decision.id,
        decisionType: parsed.data.decision_type,
      },
    })

    await logAuditEvent(supabase as never, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.DECISION_RECORDED,
      resourceType: 'decision',
      resourceId: decision.id,
      metadata: {
        applicationId,
        investigationId: application.investigation_id,
        decisionType: parsed.data.decision_type,
      },
    })

    return apiCreated(decision)
  } catch (error) {
    return handleApiError(error)
  }
}
