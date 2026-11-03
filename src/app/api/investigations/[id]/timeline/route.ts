import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { timelineEventSchema } from '@/lib/validation/schemas'
import {
  apiSuccess,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
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
      .from('timeline_events')
      .select('*')
      .eq('investigation_id', id)
      .order('created_at', { ascending: false })

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
    if (!hasPermission(user.role, 'investigations:update'))
      return apiForbidden()

    const { id } = await params
    const body = await request.json()
    const parsed = timelineEventSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('timeline_events')
      .insert({
        investigation_id: id,
        ...parsed.data,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiCreated(data)
  } catch (error) {
    return handleApiError(error)
  }
}
