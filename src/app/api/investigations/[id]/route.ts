import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:read')) return apiForbidden()

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('investigations')
      .select(
        '*, entity:entities(*), screening_results(*), timeline_events(*, created_by_user:users!timeline_events_created_by_fkey(full_name))'
      )
      .eq('id', id)
      .eq('org_id', user.orgId)
      .single()

    if (error || !data) return apiNotFound('Investigation not found')

    return apiSuccess(data)
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
    const supabase = await createClient()

    const { error } = await supabase
      .from('investigations')
      .delete()
      .eq('id', id)
      .eq('org_id', user.orgId)

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiSuccess({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
