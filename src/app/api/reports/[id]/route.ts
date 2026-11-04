import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { validateUUID } from '@/lib/security/input-validator'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'reports:read')) return apiForbidden()

    const { id } = await params
    validateUUID(id)
    const supabase = await createClient()

    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !report) {
      return apiError('Report not found', 404)
    }

    const { data: investigation } = await supabase
      .from('investigations')
      .select('*')
      .eq('id', report.investigation_id)
      .single()

    const { data: entity } = investigation
      ? await supabase
          .from('entities')
          .select('*')
          .eq('id', investigation.entity_id)
          .single()
      : { data: null }

    return apiSuccess({ report, investigation, entity })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'reports:update')) return apiForbidden()

    const { id } = await params
    validateUUID(id)
    const body = await request.json()
    const { title, status } = body as { title?: string; status?: string }

    const updates: {
      title?: string
      status?: 'draft' | 'in_review' | 'final' | 'archived'
    } = {}
    if (title) updates.title = title
    if (status) {
      const validStatuses = ['draft', 'in_review', 'final', 'archived'] as const
      if (!(validStatuses as readonly string[]).includes(status)) {
        return apiError('Invalid status', 400)
      }
      updates.status = status as typeof validStatuses[number]
    }

    if (Object.keys(updates).length === 0) {
      return apiError('No valid fields to update', 400)
    }

    const admin = createAdminClient()

    const { data: report, error } = await admin
      .from('reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error || !report) {
      return apiError('Failed to update report', 500)
    }

    return apiSuccess({ report })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'reports:delete')) return apiForbidden()

    const { id } = await params
    validateUUID(id)
    const admin = createAdminClient()

    const { error } = await admin
      .from('reports')
      .update({ status: 'archived' as const })
      .eq('id', id)

    if (error) {
      return apiError('Failed to delete report', 500)
    }

    return apiSuccess({ message: 'Report archived' })
  } catch (error) {
    return handleApiError(error)
  }
}
