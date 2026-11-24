import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createApplicationSchema } from '@/lib/validation/schemas'
import {
  apiSuccess,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiError,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { logAuditEvent, AUDIT_ACTIONS } from '@/lib/security/audit'

export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'applications:read')) return apiForbidden()

    const { searchParams } = request.nextUrl
    const investigationId = searchParams.get('investigation_id')
    const status = searchParams.get('status')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const offset = (page - 1) * limit

    const supabase = await createClient()

    let query = supabase
      .from('applications')
      .select('*', { count: 'exact' })
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (investigationId) {
      query = query.eq('investigation_id', investigationId)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiSuccess({
      applications: data,
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
    if (!hasPermission(user.role, 'applications:create')) return apiForbidden()

    const body = await request.json()
    const parsed = createApplicationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()

    const { data: investigation, error: invError } = await supabase
      .from('investigations')
      .select('id, entity_id')
      .eq('id', parsed.data.investigation_id)
      .eq('org_id', user.orgId)
      .maybeSingle()

    if (invError) return apiError(invError.message, 500, 'DB_ERROR')
    if (!investigation) return apiNotFound('Investigation not found')

    const submittedAt =
      parsed.data.status === 'submitted' ? new Date().toISOString() : null

    const { data: application, error } = await supabase
      .from('applications')
      .insert({
        org_id: user.orgId,
        investigation_id: parsed.data.investigation_id,
        status: parsed.data.status,
        submitted_at: submittedAt,
      })
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    await logAuditEvent(supabase as never, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.APPLICATION_CREATED,
      resourceType: 'application',
      resourceId: application.id,
      metadata: {
        investigationId: parsed.data.investigation_id,
        status: parsed.data.status,
      },
    })

    return apiCreated(application)
  } catch (error) {
    return handleApiError(error)
  }
}
