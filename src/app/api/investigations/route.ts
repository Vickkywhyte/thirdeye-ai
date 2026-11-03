import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createInvestigationSchema } from '@/lib/validation/schemas'
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
    if (!hasPermission(user.role, 'investigations:read')) return apiForbidden()

    const { searchParams } = request.nextUrl
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status')
    const assignedTo = searchParams.get('assigned_to')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const offset = (page - 1) * limit

    const supabase = await createClient()

    let query = supabase
      .from('investigations')
      .select('*, entity:entities!inner(id, name, type, jurisdiction)', {
        count: 'exact',
      })
      .eq('org_id', user.orgId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status as 'active' | 'pending_review' | 'completed' | 'escalated' | 'archived')
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo)
    }
    if (search) {
      query = query.ilike('entities.name', `%${search}%`)
    }

    const { data, error, count } = await query

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiSuccess({
      investigations: data,
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
    if (!hasPermission(user.role, 'investigations:create'))
      return apiForbidden()

    const body = await request.json()
    const parsed = createInvestigationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()

    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .insert({
        org_id: user.orgId,
        name: parsed.data.entity_name,
        type: parsed.data.entity_type,
        jurisdiction: parsed.data.jurisdiction,
        registration_number: parsed.data.registration_number,
      })
      .select()
      .single()

    if (entityError) return apiError(entityError.message, 500, 'DB_ERROR')

    const { data: investigation, error: invError } = await supabase
      .from('investigations')
      .insert({
        org_id: user.orgId,
        entity_id: entity.id,
        created_by: user.id,
        status: 'active',
      })
      .select()
      .single()

    if (invError) return apiError(invError.message, 500, 'DB_ERROR')

    await supabase.from('timeline_events').insert({
      investigation_id: investigation.id,
      event_type: 'investigation_created',
      title: 'Investigation created',
      description: `Investigation opened for ${entity.name}`,
      created_by: user.id,
    })

    return apiCreated({ ...investigation, entity })
  } catch (error) {
    return handleApiError(error)
  }
}
