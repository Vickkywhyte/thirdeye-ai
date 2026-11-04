'use client'

import { useState } from 'react'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { MetricsStrip } from '@/components/dashboard/metrics-strip'
import { RiskDistributionChart } from '@/components/dashboard/risk-distribution-chart'
import { InvestigationTrendChart } from '@/components/dashboard/investigation-trend-chart'
import { ScreeningBreakdown } from '@/components/dashboard/screening-breakdown'
import { TopRiskEntities } from '@/components/dashboard/top-risk-entities'
import { RecentActivity } from '@/components/dashboard/recent-activity'

export function DashboardClient() {
  const [trendDays, setTrendDays] = useState<30 | 90>(30)
  const { data, isLoading } = useDashboardData(trendDays)

  return (
    <div className="space-y-6">
      <MetricsStrip metrics={data?.metrics} isLoading={isLoading} />

      <div className="grid gap-6 lg:grid-cols-2">
        <InvestigationTrendChart
          data={data?.trend}
          period={trendDays}
          onPeriodChange={setTrendDays}
        />
        <RiskDistributionChart data={data?.riskDistribution} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ScreeningBreakdown data={data?.screeningBreakdown} />
        <TopRiskEntities data={data?.topRiskEntities} />
      </div>

      <RecentActivity data={data?.recentActivity} />
    </div>
  )
}
