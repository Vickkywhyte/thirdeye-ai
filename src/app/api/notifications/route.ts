import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  apiSuccess,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:read')) return apiForbidden()

    const supabase = await createClient()

    const [eventsRes, userRes] = await Promise.all([
      supabase
        .from('timeline_events')
        .select(
          'id, event_type, title, description, created_at, investigation_id, investigations!inner(org_id, entity:entities!inner(name))'
        )
        .eq('investigations.org_id', user.orgId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('users')
        .select('last_read_at')
        .eq('id', user.id)
        .single(),
    ])

    const lastReadAt: string | null = (userRes.data as { last_read_at: string | null } | null)?.last_read_at ?? null

    const notifications = (eventsRes.data ?? []).map((e) => {
      const inv = e.investigations as unknown as {
        org_id: string
        entity: { name: string }
      } | null

      return {
        id: e.id,
        event_type: e.event_type,
        title: e.title,
        description: e.description,
        created_at: e.created_at,
        investigation_id: e.investigation_id,
        entity_name: inv?.entity?.name ?? null,
      }
    })

    return apiSuccess({ notifications, last_read_at: lastReadAt })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(_request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()

    const supabase = await createClient()
    const now = new Date().toISOString()

    await supabase
      .from('users')
      .update({ last_read_at: now } as never)
      .eq('id', user.id)

    return apiSuccess({ last_read_at: now })
  } catch (error) {
    return handleApiError(error)
  }
}
