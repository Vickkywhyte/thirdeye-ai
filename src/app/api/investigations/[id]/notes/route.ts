import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { analystNoteSchema } from '@/lib/validation/schemas'
import {
  apiSuccess,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiError,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'notes:read')) return apiForbidden()

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('analyst_notes')
      .select('*, author:users!analyst_notes_author_id_fkey(full_name)')
      .eq('investigation_id', id)
      .order('created_at', { ascending: false })

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiSuccess(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'notes:create')) return apiForbidden()

    const { id } = await params
    const body = await request.json()
    const parsed = analystNoteSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('analyst_notes')
      .insert({
        investigation_id: id,
        content: parsed.data.content,
        author_id: user.id,
      })
      .select()
      .single()

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    return apiCreated(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'notes:update')) return apiForbidden()

    const { id: _investigationId } = await params
    const body = await request.json()
    const noteId = body.note_id as string | undefined
    if (!noteId) return apiError('note_id is required', 400, 'VALIDATION_ERROR')

    const parsed = analystNoteSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('analyst_notes')
      .update({ content: parsed.data.content })
      .eq('id', noteId)
      .eq('author_id', user.id)
      .select()
      .single()

    if (error || !data) {
      return apiError('Note not found or not owned by you', 404, 'NOT_FOUND')
    }

    return apiSuccess(data)
  } catch (error) {
    return handleApiError(error)
  }
}
