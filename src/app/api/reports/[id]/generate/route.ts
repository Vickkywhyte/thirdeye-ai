import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildReportData } from '@/lib/reports/builder'
import { generatePDF } from '@/lib/reports/pdf-generator'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import type { ReportTemplate, Json } from '@/types/database'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'reports:create')) return apiForbidden()

    const { id } = await params
    const admin = createAdminClient()

    const { data: report, error: reportErr } = await admin
      .from('reports')
      .select('*')
      .eq('id', id)
      .single()

    if (reportErr || !report) {
      return apiError('Report not found', 404)
    }

    await admin
      .from('reports')
      .update({
        status: 'in_review' as const,
        content: { status: 'generating', startedAt: new Date().toISOString() } as unknown as Json,
      })
      .eq('id', id)

    try {
      const reportData = await buildReportData(
        report.investigation_id,
        user.fullName ?? user.email ?? 'Unknown'
      )

      const pdfBuffer = await generatePDF(
        reportData,
        report.template as ReportTemplate
      )

      const filePath = `${report.org_id}/${id}.pdf`

      const { error: uploadErr } = await admin.storage
        .from('reports')
        .upload(filePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (uploadErr) {
        await admin
          .from('reports')
          .update({
            status: 'draft' as const,
            content: {
              status: 'failed',
              error: uploadErr.message,
              failedAt: new Date().toISOString(),
            } as unknown as Json,
          })
          .eq('id', id)
        return apiError(`PDF upload failed: ${uploadErr.message}`, 500)
      }

      const { data: signedUrl } = await admin.storage
        .from('reports')
        .createSignedUrl(filePath, 3600)

      await admin
        .from('reports')
        .update({
          status: 'final' as const,
          content: {
            status: 'ready',
            filePath,
            generatedAt: new Date().toISOString(),
            generatedBy: user.id,
            fileSize: pdfBuffer.length,
          } as unknown as Json,
        })
        .eq('id', id)

      return apiSuccess({
        url: signedUrl?.signedUrl ?? null,
        filePath,
        status: 'ready',
      })
    } catch (genErr) {
      const errMsg =
        genErr instanceof Error ? genErr.message : 'Generation failed'

      await admin
        .from('reports')
        .update({
          status: 'draft' as const,
          content: {
            status: 'failed',
            error: errMsg,
            failedAt: new Date().toISOString(),
          } as unknown as Json,
        })
        .eq('id', id)

      return apiError(errMsg, 500)
    }
  } catch (error) {
    return handleApiError(error)
  }
}
