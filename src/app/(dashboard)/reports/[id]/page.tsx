import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { ReportViewerClient } from '@/components/reports/report-viewer-client'
import { connection } from 'next/server'

export const instant = false

type PageProps = { params: Promise<{ id: string }> }

export default async function ReportViewerPage({ params }: PageProps) {
  await connection()
  const { id } = await params

  const user = await getUser()
  if (!user) redirect('/login')
  if (!hasPermission(user.role, 'reports:read')) notFound()

  const supabase = await createClient()
  const { data: report } = await supabase
    .from('reports')
    .select('id, title, template, status, investigation_id, content, created_at')
    .eq('id', id)
    .single()

  if (!report) notFound()

  return (
    <ReportViewerClient
      reportId={report.id}
      title={report.title}
      template={report.template}
      status={report.status}
      investigationId={report.investigation_id}
      content={report.content as Record<string, unknown> | null}
    />
  )
}
