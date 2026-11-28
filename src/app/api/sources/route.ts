import { NextRequest, connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createSourceSchema } from '@/lib/validation/schemas'
import {
  apiSuccess,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiError,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { logAuditEvent, AUDIT_ACTIONS } from '@/lib/security/audit'

const ALLOWED_SOURCE_TYPES = new Set([
  'registry',
  'sanctions',
  'pep',
  'media',
  'llm',
  'manual',
])

export async function GET(request: NextRequest) {
  await connection()
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'sources:read')) return apiForbidden()

    const { searchParams } = request.nextUrl
    const sourceType = searchParams.get('source_type')
    const q = searchParams.get('q')?.trim() ?? ''
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 50)))

    const supabase = await createClient()

    let query = supabase
      .from('sources')
      .select('id, source_type, source_name, source_url, authority_tier, retrieved_at, created_at')
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (sourceType && ALLOWED_SOURCE_TYPES.has(sourceType)) {
      query = query.eq(
        'source_type',
        sourceType as 'registry' | 'sanctions' | 'pep' | 'media' | 'llm' | 'manual'
      )
    }
    if (q) {
      query = query.ilike('source_name', `%${q}%`)
    }

    const { data, error } = await query
    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiSuccess({ sources: data })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'sources:create')) return apiForbidden()

    const body = await request.json()
    const parsed = createSourceSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()
    const { data: source, error } = await supabase
      .from('sources')
      .insert({
        org_id: user.orgId,
        source_type: parsed.data.source_type,
        source_name: parsed.data.source_name,
        source_url: parsed.data.source_url ?? null,
        authority_tier: parsed.data.authority_tier,
      })
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    await logAuditEvent(supabase as never, {
      userId: user.id,
      orgId: user.orgId,
      action: AUDIT_ACTIONS.SOURCE_CREATED,
      resourceType: 'source',
      resourceId: source.id,
      metadata: {
        sourceType: parsed.data.source_type,
        authorityTier: parsed.data.authority_tier,
      },
    })

    return apiCreated(source)
  } catch (error) {
    return handleApiError(error)
  }
}
