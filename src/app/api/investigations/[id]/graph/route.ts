import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { buildGraphData } from '@/lib/graph/builder'
import { apiSuccess, apiError, apiForbidden, apiUnauthorized } from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:read')) return apiForbidden()

    const { id } = await params

    const result = await buildGraphData(id, user.orgId)

    if (result.totalNodes === 0) {
      return apiSuccess({
        graphData: { nodes: [], edges: [] },
        maxDepth: 0,
        totalNodes: 0,
        totalEdges: 0,
      })
    }

    return apiSuccess(result)
  } catch (error) {
    return handleApiError(error)
  }
}
