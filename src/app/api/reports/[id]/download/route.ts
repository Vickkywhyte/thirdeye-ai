import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  apiError,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'reports:read')) return apiForbidden()

    const { id } = await params
    const supabase = await createClient()

    const { data: report } = await supabase
      .from('reports')
      .select('content, title')
      .eq('id', id)
      .single()

    if (!report) {
      return apiError('Report not found', 404)
    }

    const content = report.content as Record<string, unknown> | null
    const filePath = content?.filePath as string | undefined

    if (!filePath || content?.status !== 'ready') {
      return apiError('Report PDF not yet generated', 400)
    }

    const admin = createAdminClient()
    const { data: signedUrl, error } = await admin.storage
      .from('reports')
      .createSignedUrl(filePath, 3600)

    if (error || !signedUrl?.signedUrl) {
      return apiError('Failed to generate download URL', 500)
    }

    return NextResponse.redirect(signedUrl.signedUrl)
  } catch (error) {
    return handleApiError(error)
  }
}
