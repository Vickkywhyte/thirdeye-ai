'use client'

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RiskBand } from '@/lib/analytics/queries'

interface RiskDistributionChartProps {
  data: RiskBand[] | undefined
}

export function RiskDistributionChart({ data }: RiskDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-zinc-500">No scored investigations yet</p>
        </CardContent>
      </Card>
    )
  }

  const chartData = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: d.label,
      value: d.percentage,
      count: d.count,
      fill: d.color,
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Risk Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="30%"
            outerRadius="90%"
            data={chartData}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              dataKey="value"
              isAnimationActive
              animationDuration={800}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-4">
          {data.map((band) => (
            <div key={band.label} className="flex items-center gap-1.5 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: band.color }}
              />
              <span className="text-zinc-400">
                {band.label}: {band.count} ({band.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
