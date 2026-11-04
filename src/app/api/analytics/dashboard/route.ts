import { getUser } from '@/lib/auth/session'
import {
  getDashboardMetrics,
  getRiskDistribution,
  getInvestigationTrend,
  getScreeningBreakdown,
  getTopRiskEntities,
  getRecentActivity,
} from '@/lib/analytics/queries'
import { apiSuccess, apiUnauthorized } from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()

    const { searchParams } = new URL(request.url)
    const trendDays = searchParams.get('days') === '90' ? 90 : 30

    const [
      metrics,
      riskDistribution,
      trend,
      screeningBreakdown,
      topRiskEntities,
      recentActivity,
    ] = await Promise.all([
      getDashboardMetrics(user.orgId),
      getRiskDistribution(user.orgId),
      getInvestigationTrend(user.orgId, trendDays as 30 | 90),
      getScreeningBreakdown(user.orgId),
      getTopRiskEntities(user.orgId, 5),
      getRecentActivity(user.orgId, 10),
    ])

    return apiSuccess({
      metrics,
      riskDistribution,
      trend,
      screeningBreakdown,
      topRiskEntities,
      recentActivity,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
