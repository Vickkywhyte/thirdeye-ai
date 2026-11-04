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
      .select('*')
      .eq('investigation_id', investigationId)
      .order('created_at', { ascending: true })

    if (error) {
      return apiError('Failed to fetch screening status', 500)
    }

    const resultsWithHits = await Promise.all(
      results.map(async (r) => {
        const { data: hits } = await supabase
          .from('screening_hits')
          .select('*')
          .eq('result_id', r.id)
        return { ...r, screening_hits: hits ?? [] }
      })
    )

    const allCompleted = results.every(
      (r) => r.status === 'completed' || r.status === 'failed'
    )
    const anyRunning = results.some(
      (r) => r.status === 'running' || r.status === 'pending'
    )

    return apiSuccess({
      investigation_id: investigationId,
      status: anyRunning ? 'running' : allCompleted ? 'completed' : 'pending',
      results: resultsWithHits,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
