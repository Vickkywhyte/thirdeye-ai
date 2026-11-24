'use client'

import { useState } from 'react'
import { Radio, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { MetricsStrip } from '@/components/dashboard/metrics-strip'
import { RiskDistributionChart } from '@/components/dashboard/risk-distribution-chart'
import { InvestigationTrendChart } from '@/components/dashboard/investigation-trend-chart'
import { ScreeningBreakdown } from '@/components/dashboard/screening-breakdown'
import { TopRiskEntities } from '@/components/dashboard/top-risk-entities'
import { RecentActivity } from '@/components/dashboard/recent-activity'

export function DashboardClient() {
  const [trendDays, setTrendDays] = useState<30 | 90>(30)
  const { data, isLoading, mutate } = useDashboardData(trendDays)
  const [monitoring, setMonitoring] = useState(false)
  const [monitorResult, setMonitorResult] = useState<{ monitored: number } | null>(null)

  async function runPortfolioMonitoring() {
    setMonitoring(true)
    setMonitorResult(null)
    try {
      const res = await fetch('/api/portfolio-monitoring', { method: 'POST' })
      if (res.ok) {
        const json = await res.json()
        setMonitorResult(json.data)
        // Refresh metrics so the "Portfolio Monitored" card updates
        await mutate()
      }
    } catch {
      // non-fatal
    } finally {
      setMonitoring(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {monitorResult && (
            <p className="text-sm text-teal-400">
              ✓ Monitored {monitorResult.monitored} investigation{monitorResult.monitored !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Button
          onClick={runPortfolioMonitoring}
          disabled={monitoring}
          variant="outline"
          className="gap-2 border-teal-500/30 text-teal-400 hover:bg-teal-500/10 hover:text-teal-300"
        >
          {monitoring ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Radio className="h-4 w-4" />
          )}
          {monitoring ? 'Running…' : 'Run Portfolio Monitoring'}
        </Button>
      </div>

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
