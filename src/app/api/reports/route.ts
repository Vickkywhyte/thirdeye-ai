import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  apiSuccess,
  apiCreated,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import type { ReportTemplate } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'reports:read')) return apiForbidden()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)
    const offset = (page - 1) * limit

    const supabase = await createClient()

    let query = supabase
      .from('reports')
      .select('*', { count: 'exact' })
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq(
        'status',
        status as 'draft' | 'in_review' | 'final' | 'archived'
      )
    }

    const { data, error, count } = await query

    if (error) {
      return apiError('Failed to fetch reports', 500)
    }

    return apiSuccess({ reports: data, total: count ?? 0, page, limit })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'reports:create')) return apiForbidden()

    const body = await request.json()
    const { investigationId, template, title } = body as {
      investigationId?: string
      template?: ReportTemplate
      title?: string
    }

    if (!investigationId || !title) {
      return apiError('investigationId and title are required', 400)
    }

    const validTemplates: ReportTemplate[] = [
      'standard_dd',
      'enhanced_dd',
      'sanctions_alert',
      'periodic_review',
    ]
    const reportTemplate = validTemplates.includes(template as ReportTemplate)
      ? (template as ReportTemplate)
      : 'standard_dd'

    const supabase = await createClient()

    const { data: investigation } = await supabase
      .from('investigations')
      .select('id, org_id')
      .eq('id', investigationId)
      .single()

    if (!investigation) {
      return apiError('Investigation not found', 404)
    }

    const admin = createAdminClient()

    const { data: report, error } = await admin
      .from('reports')
      .insert({
        investigation_id: investigationId,
        org_id: investigation.org_id,
        template: reportTemplate,
        status: 'draft' as const,
        title,
        content: { status: 'draft' } as unknown as import('@/types/database').Json,
        generated_by: user.id,
      })
      .select()
      .single()

    if (error || !report) {
      return apiError('Failed to create report', 500)
    }

    return apiCreated({ report })
  } catch (error) {
    return handleApiError(error)
  }
}
