import { NextRequest, connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiError,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'

export async function GET(request: NextRequest) {
  await connection()
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    const canCreate = hasPermission(user.role, 'escalations:create')
    const canResolve = hasPermission(user.role, 'escalations:resolve')
    if (!canCreate && !canResolve) return apiForbidden()

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const assignedTo = searchParams.get('assigned_to')
    const investigationId = searchParams.get('investigation_id')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const offset = (page - 1) * limit

    const supabase = await createClient()

    let query = supabase
      .from('escalations')
      .select('*', { count: 'exact' })
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status === 'open' || status === 'resolved') {
      query = query.eq('status', status)
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo)
    }
    if (investigationId) {
      query = query.eq('investigation_id', investigationId)
    }

    const { data, error, count } = await query

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiSuccess({
      escalations: data,
      pagination: { page, limit, total: count ?? 0 },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
