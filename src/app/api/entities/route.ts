import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { entitySchema } from '@/lib/validation/schemas'
import {
  apiSuccess,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiError,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'

export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'entities:read')) return apiForbidden()

    const { searchParams } = request.nextUrl
    const search = searchParams.get('search') ?? ''
    const type = searchParams.get('type')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const offset = (page - 1) * limit

    const supabase = await createClient()

    let query = supabase
      .from('entities')
      .select('*', { count: 'exact' })
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }
    if (type) {
      query = query.eq('type', type as 'individual' | 'company' | 'trust' | 'partnership' | 'other')
    }

    const { data, error, count } = await query

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiSuccess({
      entities: data,
      pagination: { page, limit, total: count ?? 0 },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'entities:create')) return apiForbidden()

    const body = await request.json()
    const parsed = entitySchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('entities')
      .insert({ ...parsed.data, org_id: user.orgId })
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiCreated(data)
  } catch (error) {
    return handleApiError(error)
  }
}
