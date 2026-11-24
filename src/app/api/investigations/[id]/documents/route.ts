import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  apiSuccess,
  apiCreated,
  apiError,
  apiForbidden,
  apiUnauthorized,
  apiNotFound,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { validateUUID } from '@/lib/security/input-validator'

type RouteParams = { params: Promise<{ id: string }> }

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
export const DOCUMENTS_BUCKET = 'documents'

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'documents:read')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const supabase = createAdminClient()

    // Verify the investigation belongs to the caller's org; admin client
    // bypasses RLS, so ownership must be enforced in code.
    const { data: investigation } = await supabase
      .from('investigations')
      .select('id')
      .eq('id', id)
      .eq('org_id', user.orgId)
      .single()

    if (!investigation) return apiNotFound('Investigation not found')

    const { data: docs, error } = await supabase
      .from('documents')
      .select('*')
      .eq('investigation_id', id)
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false })

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    // Resolve uploader names in one batched query to avoid N+1 lookups and
    // the joined-select pattern (which returns null here due to empty Relationships).
    const uploaderIds = Array.from(
      new Set((docs ?? []).map((d) => d.uploaded_by))
    )
    const nameById = new Map<string, string>()
    if (uploaderIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', uploaderIds)
      for (const u of users ?? []) nameById.set(u.id, u.full_name)
    }

    return apiSuccess(
      (docs ?? []).map((d) => ({
        id: d.id,
        file_name: d.file_name,
        file_type: d.file_type,
        file_size_bytes: d.file_size_bytes,
        uploaded_by: d.uploaded_by,
        uploaded_by_name: nameById.get(d.uploaded_by) ?? null,
        created_at: d.created_at,
      }))
    )
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'documents:upload')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const supabase = createAdminClient()

    const { data: investigation } = await supabase
      .from('investigations')
      .select('id')
      .eq('id', id)
      .eq('org_id', user.orgId)
      .single()

    if (!investigation) return apiNotFound('Investigation not found')

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return apiError('No file uploaded', 400, 'VALIDATION_ERROR')
    }
    if (file.size === 0) {
      return apiError('File is empty', 400, 'VALIDATION_ERROR')
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return apiError(
        `File exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit`,
        413,
        'FILE_TOO_LARGE'
      )
    }

    // Namespace by org/investigation so the storage policy can scope by path
    // segment and files from different investigations never collide.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180)
    const path = `${user.orgId}/${id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`

    const { error: uploadErr } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadErr) {
      return apiError(
        `Storage upload failed: ${uploadErr.message}`,
        500,
        'STORAGE_ERROR'
      )
    }

    const { data: doc, error: insertErr } = await supabase
      .from('documents')
      .insert({
        investigation_id: id,
        org_id: user.orgId,
        file_name: file.name,
        file_path: path,
        file_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (insertErr || !doc) {
      // Roll back the storage object so there isn't an orphan with no DB row.
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([path])
      return apiError(
        insertErr?.message ?? 'Failed to persist document',
        500,
        'DB_ERROR'
      )
    }

    await supabase.from('timeline_events').insert({
      investigation_id: id,
      event_type: 'document_uploaded',
      title: 'Document uploaded',
      description: file.name,
      created_by: user.id,
    })

    return apiCreated({
      id: doc.id,
      file_name: doc.file_name,
      file_type: doc.file_type,
      file_size_bytes: doc.file_size_bytes,
      uploaded_by: doc.uploaded_by,
      uploaded_by_name: user.fullName,
      created_at: doc.created_at,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
