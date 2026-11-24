import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { AUDIT_ACTIONS } from '@/lib/security/audit'
import type { Json } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * Authenticate the request against CRON_SECRET.
 * Accepts either `Authorization: Bearer <secret>` (Vercel Cron) or `?secret=<secret>`.
 */
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  const header = request.headers.get('authorization') ?? ''
  if (header === `Bearer ${expected}`) return true

  const q = request.nextUrl.searchParams.get('secret')
  if (q && q === expected) return true

  return false
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const supabase = createAdminClient()
    const now = new Date().toISOString()

    const { data: overdueReviews, error: selectError } = await supabase
      .from('reviews')
      .select('id, org_id, investigation_id')
      .eq('status', 'pending')
      .lt('due_date', now)

    if (selectError) return apiError(selectError.message, 500, 'DB_ERROR')

    const reviews = overdueReviews ?? []
    if (reviews.length === 0) {
      return NextResponse.json({ data: { marked_overdue: 0, reviews: [] } })
    }

    const ids = reviews.map((r) => r.id)

    const { error: updateError } = await supabase
      .from('reviews')
      .update({ status: 'overdue' })
      .in('id', ids)

    if (updateError) return apiError(updateError.message, 500, 'DB_ERROR')

    const timelineRows = reviews.map((r) => ({
      investigation_id: r.investigation_id,
      event_type: 'review_overdue',
      title: 'Periodic review overdue',
      description: 'Scheduled review passed its due date without completion.',
      created_by: null,
      data: { reviewId: r.id } as Json,
    }))
    await supabase.from('timeline_events').insert(timelineRows)

    const auditRows = reviews.map((r) => ({
      org_id: r.org_id,
      user_id: null,
      action: AUDIT_ACTIONS.REVIEW_MARKED_OVERDUE,
      resource_type: 'review',
      resource_id: r.id,
      data: { investigationId: r.investigation_id } as Json,
    }))
    await supabase.from('audit_log').insert(auditRows)

    return NextResponse.json({
      data: {
        marked_overdue: reviews.length,
        reviews: ids,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
