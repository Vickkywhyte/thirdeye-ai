import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  apiUnauthorized,
  apiNotFound,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { validateUUID } from '@/lib/security/input-validator'
import { DOCUMENTS_BUCKET } from '../route'

type RouteParams = { params: Promise<{ id: string; docId: string }> }

const SIGNED_URL_TTL_SECONDS = 60

/** Return a short-lived signed URL. The bucket is private; direct links 403. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'documents:read')) return apiForbidden()

    const { id, docId } = await params
    validateUUID(id)
    validateUUID(docId)

    const supabase = createAdminClient()

    const { data: doc } = await supabase
      .from('documents')
      .select('id, file_name, file_path, org_id, investigation_id')
      .eq('id', docId)
      .eq('investigation_id', id)
      .eq('org_id', user.orgId)
      .single()

    if (!doc) return apiNotFound('Document not found')

    const { data: signed, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(doc.file_path, SIGNED_URL_TTL_SECONDS, {
        download: doc.file_name,
      })

    if (error || !signed?.signedUrl) {
      return apiError(
        error?.message ?? 'Could not create download link',
        500,
        'STORAGE_ERROR'
      )
    }

    // Optional ?redirect=1 for direct link usage; default returns JSON.
    if (new URL(request.url).searchParams.get('redirect') === '1') {
      return Response.redirect(signed.signedUrl, 302)
    }

    return apiSuccess({ url: signed.signedUrl, expires_in: SIGNED_URL_TTL_SECONDS })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'documents:delete')) return apiForbidden()

    const { id, docId } = await params
    validateUUID(id)
    validateUUID(docId)

    const supabase = createAdminClient()

    const { data: doc } = await supabase
      .from('documents')
      .select('id, file_path, org_id, investigation_id')
      .eq('id', docId)
      .eq('investigation_id', id)
      .eq('org_id', user.orgId)
      .single()

    if (!doc) return apiNotFound('Document not found')

    // Remove storage first; a leftover storage object is worse than a missing
    // DB row, since the DB is the authoritative list.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path])

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId)

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiSuccess({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
