import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { upsertEddSchema } from '@/lib/validation/schemas'
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
import type { Json } from '@/types/database'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'edd:read')) return apiForbidden()

    const { id: investigationId } = await params
    validateUUID(investigationId)

    const supabase = await createClient()

    const { data: investigation, error: invError } = await supabase
      .from('investigations')
      .select('id')
      .eq('id', investigationId)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (invError) return apiError(invError.message, 500, 'DB_ERROR')
    if (!investigation) return apiNotFound('Investigation not found')

    const { data, error } = await supabase
      .from('edd_assessments')
      .select('*')
      .eq('investigation_id', investigationId)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiSuccess(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:update')) return apiForbidden()

    const { id: investigationId } = await params
    validateUUID(investigationId)

    const body = await request.json()
    const parsed = upsertEddSchema.safeParse(body)
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

    const { data: existing, error: existingError } = await supabase
      .from('edd_assessments')
      .select('id, status')
      .eq('investigation_id', investigationId)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (existingError) return apiError(existingError.message, 500, 'DB_ERROR')

    const completing =
      parsed.data.status === 'completed' && existing?.status !== 'completed'

    const payload = {
      org_id: user.orgId,
      investigation_id: investigationId,
      status: parsed.data.status,
      risk_factors: parsed.data.risk_factors as Json,
      notes: parsed.data.notes ?? null,
      source_id: parsed.data.source_id ?? null,
      completed_by: completing ? user.id : (existing ? undefined : null),
      completed_at: completing
        ? new Date().toISOString()
        : (existing ? undefined : null),
    }

    const { data: assessment, error } = await supabase
      .from('edd_assessments')
      .upsert(payload, { onConflict: 'investigation_id' })
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    const isCreate = !existing

    if (completing) {
      await supabase.from('timeline_events').insert({
        investigation_id: investigationId,
        event_type: 'edd_completed',
        title: 'EDD assessment completed',
        description: parsed.data.notes?.slice(0, 500) ?? null,
        created_by: user.id,
        data: { eddAssessmentId: assessment.id },
      })
    }

    await logAuditEvent(supabase as never, {
      userId: user.id,
      orgId: user.orgId,
      action: isCreate
        ? AUDIT_ACTIONS.EDD_CREATED
        : AUDIT_ACTIONS.EDD_UPDATED,
      resourceType: 'edd_assessment',
      resourceId: assessment.id,
      metadata: {
        investigationId,
        status: parsed.data.status,
        completed: completing,
      },
    })

    return isCreate ? apiCreated(assessment) : apiSuccess(assessment)
  } catch (error) {
    return handleApiError(error)
  }
}
