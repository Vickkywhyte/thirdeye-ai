import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'

type RouteParams = { params: Promise<{ investigationId: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:read')) return apiForbidden()

    const { investigationId } = await params
    const supabase = await createClient()

    const { data: results, error } = await supabase
      .from('screening_results')
      .select('*, screening_hits(*)')
      .eq('investigation_id', investigationId)
      .order('created_at', { ascending: true })

    if (error) {
      return apiError('Failed to fetch screening status', 500)
    }

    const allCompleted = results.every(
      (r) => r.status === 'completed' || r.status === 'failed'
    )
    const anyRunning = results.some(
      (r) => r.status === 'running' || r.status === 'pending'
    )

    return apiSuccess({
      investigation_id: investigationId,
      status: anyRunning ? 'running' : allCompleted ? 'completed' : 'pending',
      results,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
