import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { updateEddSchema } from '@/lib/validation/schemas'
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
import type { Json, Database } from '@/types/database'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'edd:read')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('edd_assessments')
      .select('*')
      .eq('id', id)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (error) return apiError(error.message, 500, 'DB_ERROR')
    if (!data) return apiNotFound('EDD assessment not found')

    return apiSuccess(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'edd:update')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const body = await request.json()
    const parsed = updateEddSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('edd_assessments')
      .select('id, investigation_id, status')
      .eq('id', id)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (existingError) return apiError(existingError.message, 500, 'DB_ERROR')
    if (!existing) return apiNotFound('EDD assessment not found')

    const completing =
      parsed.data.status === 'completed' && existing.status !== 'completed'

    const update: Database['public']['Tables']['edd_assessments']['Update'] = {}
    if (parsed.data.status !== undefined) update.status = parsed.data.status
    if (parsed.data.risk_factors !== undefined) {
      update.risk_factors = parsed.data.risk_factors as Json
    }
    if (parsed.data.notes !== undefined) update.notes = parsed.data.notes
    if (parsed.data.source_id !== undefined) update.source_id = parsed.data.source_id
    if (completing) {
      update.completed_by = user.id
      update.completed_at = new Date().toISOString()
    }

    const { data: assessment, error } = await supabase
      .from('edd_assessments')
      .update(update)
      .eq('id', id)
      .eq('org_id', user.orgId)
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    if (completing) {
      await supabase.from('timeline_events').insert({
        investigation_id: existing.investigation_id,
        event_type: 'edd_completed',
        title: 'EDD assessment completed',
        description: parsed.data.notes?.slice(0, 500) ?? null,
        created_by: user.id,
        data: { eddAssessmentId: id },
      })
    }

    await logAuditEvent(supabase as never, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.EDD_UPDATED,
      resourceType: 'edd_assessment',
      resourceId: id,
      metadata: {
        investigationId: existing.investigation_id,
        fromStatus: existing.status,
        toStatus: parsed.data.status ?? existing.status,
        completed: completing,
      },
    })

    return apiSuccess(assessment)
  } catch (error) {
    return handleApiError(error)
  }
}
