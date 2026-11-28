import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { AUDIT_ACTIONS } from '@/lib/security/audit'
import type { Json } from '@/types/database'

const TIMEOUT_MINUTES = 10

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = request.headers.get('authorization') ?? ''
  if (header === `Bearer ${expected}`) return true
  const q = request.nextUrl.searchParams.get('secret')
  if (q && q === expected) return true
  return false
}

/**
 * Finds screening_results rows stuck in 'running' for longer than
 * TIMEOUT_MINUTES (typically because the server restarted mid-screening)
 * and marks them as 'failed' with a clear error_message so the UI can
 * surface a Retry button. One audit row per recovered result.
 */
export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const supabase = createAdminClient()

    const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000).toISOString()

    const { data: stuck, error: selectError } = await supabase
      .from('screening_results')
      .select('id, investigation_id, type, started_at')
      .eq('status', 'running')
      .lt('started_at', cutoff)

    if (selectError) return apiError(selectError.message, 500, 'DB_ERROR')

    const rows = stuck ?? []
    if (rows.length === 0) {
      return NextResponse.json({ data: { recovered: 0, results: [] } })
    }

    const ids = rows.map((r) => r.id)
    const now = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('screening_results')
      .update({
        status: 'failed',
        error_message: 'Timeout (server restart)',
        completed_at: now,
        last_updated_at: now,
      })
      .in('id', ids)

    if (updateError) return apiError(updateError.message, 500, 'DB_ERROR')

    // Audit rows are written per-investigation; look up org_id in one trip.
    const investigationIds = [...new Set(rows.map((r) => r.investigation_id))]
    const { data: investigations } = await supabase
      .from('investigations')
      .select('id, org_id')
      .in('id', investigationIds)

    const orgByInvestigation = new Map<string, string>()
    for (const inv of investigations ?? []) {
      orgByInvestigation.set(inv.id, inv.org_id)
    }

    const auditRows = rows
      .map((r) => {
        const orgId = orgByInvestigation.get(r.investigation_id)
        if (!orgId) return null
        return {
          org_id: orgId,
          user_id: null,
          action: AUDIT_ACTIONS.SCREENING_TIMED_OUT,
          resource_type: 'screening_result',
          resource_id: r.id,
          data: {
            investigationId: r.investigation_id,
            type: r.type,
            startedAt: r.started_at,
            timeoutMinutes: TIMEOUT_MINUTES,
          } as Json,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    if (auditRows.length > 0) {
      await supabase.from('audit_log').insert(auditRows)
    }

    return NextResponse.json({
      data: {
        recovered: rows.length,
        results: ids,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
