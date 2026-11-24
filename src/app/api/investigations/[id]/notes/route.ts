import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { analystNoteSchema } from '@/lib/validation/schemas'
import {
  apiSuccess,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiError,
  apiNotFound,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { validateUUID } from '@/lib/security/input-validator'

type RouteParams = { params: Promise<{ id: string }> }

async function assertInvestigationInOrg(
  supabase: ReturnType<typeof createAdminClient>,
  investigationId: string,
  orgId: string
) {
  const { data } = await supabase
    .from('investigations')
    .select('id')
    .eq('id', investigationId)
    .eq('org_id', orgId)
    .single()
  return !!data
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'notes:read')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const supabase = createAdminClient()
    if (!(await assertInvestigationInOrg(supabase, id, user.orgId))) {
      return apiNotFound('Investigation not found')
    }

    const { data: notes, error } = await supabase
      .from('analyst_notes')
      .select('*')
      .eq('investigation_id', id)
      .order('created_at', { ascending: false })

    if (error) return apiError(error.message, 500, 'DB_ERROR')

    // Resolve author names in one batched query rather than a joined select,
    // because this codebase's Supabase types have empty Relationships -- the
    // old `author:users!analyst_notes_author_id_fkey(...)` join silently
    // returned null for every author.
    const authorIds = Array.from(new Set((notes ?? []).map((n) => n.author_id)))
    const nameById = new Map<string, string>()
    if (authorIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', authorIds)
      for (const u of users ?? []) nameById.set(u.id, u.full_name)
    }

    return apiSuccess(
      (notes ?? []).map((n) => ({
        id: n.id,
        content: n.content,
        author_id: n.author_id,
        author_name: nameById.get(n.author_id) ?? 'Unknown',
        is_pinned: n.is_pinned,
        created_at: n.created_at,
        updated_at: n.updated_at,
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
    if (!hasPermission(user.role, 'notes:create')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const body = await request.json()
    const parsed = analystNoteSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = createAdminClient()
    if (!(await assertInvestigationInOrg(supabase, id, user.orgId))) {
      return apiNotFound('Investigation not found')
    }

    const { data, error } = await supabase
      .from('analyst_notes')
      .insert({
        investigation_id: id,
        content: parsed.data.content,
        author_id: user.id,
      })
      .select()
      .single()

    if (error || !data) return apiError(error?.message ?? 'Insert failed', 500, 'DB_ERROR')

    return apiCreated({
      id: data.id,
      content: data.content,
      author_id: data.author_id,
      author_name: user.fullName,
      is_pinned: data.is_pinned,
      created_at: data.created_at,
      updated_at: data.updated_at,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'notes:update')) return apiForbidden()

    const { id } = await params
    validateUUID(id)

    const body = await request.json()
    const noteId = body.note_id as string | undefined
    if (!noteId) return apiError('note_id is required', 400, 'VALIDATION_ERROR')
    validateUUID(noteId)

    const parsed = analystNoteSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400, 'VALIDATION_ERROR')
    }

    const supabase = createAdminClient()
    if (!(await assertInvestigationInOrg(supabase, id, user.orgId))) {
      return apiNotFound('Investigation not found')
    }

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
