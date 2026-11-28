import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import {
  reviewScreeningHitSchema,
  type HitDisposition,
} from '@/lib/validation/schemas'
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

/**
 * Map a disposition to the legacy is_confirmed boolean:
 *   confirmed     → true
 *   false_positive→ false
 *   everything else → null (indeterminate)
 */
function confirmedForDisposition(d: HitDisposition): boolean | null {
  if (d === 'confirmed') return true
  if (d === 'false_positive') return false
  return null
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'screening:review')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const body = await request.json()
    const parsed = reviewScreeningHitSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()

    // RLS scopes hits by org via result_id → investigation chain, so a
    // cross-tenant id surfaces as "not found".
    const { data: existing, error: existingError } = await supabase
      .from('screening_hits')
      .select(
        'id, disposition, source, matched_name, result_id, screening_results:screening_results!inner(id, investigation_id, type)'
      )
      .eq('id', id)
      .maybeSingle()

    if (existingError) return apiError(existingError.message, 500, 'DB_ERROR')
    if (!existing) return apiNotFound('Screening hit not found')

    const sr = Array.isArray(existing.screening_results)
      ? existing.screening_results[0]
      : existing.screening_results
    const investigationId = sr?.investigation_id

    if (!investigationId) {
      return apiError('Screening hit is not linked to an investigation', 500, 'DB_ERROR')
    }

    const nowIso = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from('screening_hits')
      .update({
        disposition: parsed.data.disposition,
        review_rationale: parsed.data.rationale,
        is_confirmed: confirmedForDisposition(parsed.data.disposition),
        reviewed_at: nowIso,
        reviewed_by: user.id,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) return apiError(updateError.message, 500, 'DB_ERROR')

    await supabase.from('timeline_events').insert({
      investigation_id: investigationId,
      event_type: 'screening_hit_reviewed',
      title: `Hit reviewed: ${parsed.data.disposition.replace(/_/g, ' ')}`,
      description: parsed.data.rationale.slice(0, 500),
      created_by: user.id,
      data: {
        hitId: id,
        resultId: existing.result_id,
        screeningType: sr?.type ?? null,
        source: existing.source,
        matchedName: existing.matched_name,
        fromDisposition: existing.disposition,
        toDisposition: parsed.data.disposition,
      },
    })

    await logAuditEvent(supabase as never, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.HIT_REVIEWED,
      resourceType: 'screening_hit',
      resourceId: id,
      metadata: {
        investigationId,
        screeningType: sr?.type ?? null,
        fromDisposition: existing.disposition,
        toDisposition: parsed.data.disposition,
      },
    })

    return apiSuccess(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
