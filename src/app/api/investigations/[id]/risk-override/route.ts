import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { validateUUID } from '@/lib/security/input-validator'
import { logAuditEvent, AUDIT_ACTIONS } from '@/lib/security/audit'

type RouteParams = { params: Promise<{ id: string }> }

const RISK_LEVEL_SCORES: Record<string, number> = {
  low: 20,
  medium: 50,
  high: 75,
  critical: 90,
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:update')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const body = await request.json()
    const { riskLevel, reason } = body as { riskLevel?: string; reason?: string }

    if (!riskLevel || !(riskLevel in RISK_LEVEL_SCORES)) {
      return apiError('Invalid riskLevel. Must be low, medium, high, or critical.', 400)
    }
    if (!reason || reason.trim().length < 20) {
      return apiError('Justification must be at least 20 characters.', 400)
    }

    const admin = createAdminClient()

    // Confirm the investigation belongs to the user's org
    const { data: inv } = await admin
      .from('investigations')
      .select('id, org_id, risk_score')
      .eq('id', id)
      .single()

    if (!inv || inv.org_id !== user.orgId) {
      return apiError('Investigation not found.', 404)
    }

    const overrideScore = RISK_LEVEL_SCORES[riskLevel]
    const now = new Date().toISOString()

    await admin
      .from('investigations')
      .update({
        risk_score: overrideScore,
        override_risk_score: overrideScore,
        override_reason: reason.trim(),
        override_by: user.id,
        override_at: now,
      })
      .eq('id', id)

    const riskLabel = riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)

    await admin.from('timeline_events').insert({
      investigation_id: id,
      event_type: 'risk_override',
      title: `Risk score overridden to ${riskLabel}`,
      description: `Overridden by ${user.fullName} — Reason: ${reason.trim()}`,
      created_by: user.id,
    })

    await logAuditEvent(admin as never, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.INVESTIGATION_UPDATED,
      resourceType: 'investigation',
      resourceId: id,
      metadata: {
        action: 'risk_override',
        riskLevel,
        overrideScore,
        previousScore: inv.risk_score,
      },
    })

    return apiSuccess({ overrideScore, riskLevel })
  } catch (error) {
    return handleApiError(error)
  }
}
