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

const ALLOWED_STATUSES = new Set([
  'pending',
  'in_progress',
  'completed',
  'overdue',
])

export async function GET(request: NextRequest) {
  await connection()
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:read')) return apiForbidden()

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const investigationId = searchParams.get('investigation_id')
    const dueBefore = searchParams.get('due_before')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const offset = (page - 1) * limit

    const supabase = await createClient()

    let query = supabase
      .from('reviews')
      .select('*', { count: 'exact' })
      .eq('org_id', user.orgId)
      .order('due_date', { ascending: true })
      .range(offset, offset + limit - 1)

    if (status && ALLOWED_STATUSES.has(status)) {
      query = query.eq('status', status as 'pending' | 'in_progress' | 'completed' | 'overdue')
    }
    if (investigationId) {
      query = query.eq('investigation_id', investigationId)
    }
    if (dueBefore) {
      query = query.lte('due_date', dueBefore)
    }

    const { data, error, count } = await query

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiSuccess({
      reviews: data,
      pagination: { page, limit, total: count ?? 0 },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
