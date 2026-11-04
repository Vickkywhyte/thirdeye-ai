import useSWR from 'swr'
import type {
  DashboardMetrics,
  RiskBand,
  TrendPoint,
  ScreeningBreakdown,
  TopRiskEntity,
  RecentActivityItem,
} from '@/lib/analytics/queries'

interface DashboardData {
  metrics: DashboardMetrics
  riskDistribution: RiskBand[]
  trend: TrendPoint[]
  screeningBreakdown: ScreeningBreakdown
  topRiskEntities: TopRiskEntity[]
  recentActivity: RecentActivityItem[]
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch dashboard data')
  const json = await res.json()
  return json.data as DashboardData
}

export function useDashboardData(trendDays: 30 | 90 = 30) {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    `/api/analytics/dashboard?days=${trendDays}`,
    fetcher,
    { refreshInterval: 60000 }
  )

  return { data, isLoading, error, mutate }
}
