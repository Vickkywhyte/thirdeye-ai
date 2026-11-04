import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { buildReportData } from '@/lib/reports/builder'
import { generateHTMLPreview } from '@/lib/reports/html-preview'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import type { ReportTemplate } from '@/types/database'
import { createClient } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'reports:read')) return apiForbidden()

    const { id } = await params
    const supabase = await createClient()

    const { data: report } = await supabase
      .from('reports')
      .select('investigation_id, template')
      .eq('id', id)
      .single()

    if (!report) {
      return apiError('Report not found', 404)
    }

    const reportData = await buildReportData(
      report.investigation_id,
      user.fullName ?? user.email ?? 'Unknown'
    )

    const html = generateHTMLPreview(
      reportData,
      report.template as ReportTemplate
    )

    return apiSuccess({ html })
  } catch (error) {
    return handleApiError(error)
  }
}
