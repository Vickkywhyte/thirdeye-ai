import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  apiSuccess,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'

export async function POST() {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:read')) return apiForbidden()

    const supabase = await createClient()
    const admin = createAdminClient()
    const now = new Date().toISOString()

    // Fetch all non-archived investigations for the org
    const { data: investigations, error } = await supabase
      .from('investigations')
      .select('id, status')
      .eq('org_id', user.orgId)
      .neq('status', 'archived')

    if (error) throw error

    const ids = (investigations ?? []).map((i) => i.id)
    if (ids.length === 0) {
      return apiSuccess({ monitored: 0, message: 'No active investigations to monitor' })
    }

    // Stamp last_screened_at on all of them
    await admin
      .from('investigations')
      .update({ last_screened_at: now })
      .in('id', ids)

    // Insert a single timeline event per investigation
    const events = ids.map((id) => ({
      investigation_id: id,
      event_type: 'portfolio_monitored',
      title: 'Portfolio Monitoring Run',
      description: `Automated portfolio check completed at ${new Date(now).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.`,
    }))

    await admin.from('timeline_events').insert(events)

    return apiSuccess({ monitored: ids.length })
  } catch (error) {
    return handleApiError(error)
  }
}
