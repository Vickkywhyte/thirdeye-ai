'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { TrendPoint } from '@/lib/analytics/queries'

interface InvestigationTrendChartProps {
  data: TrendPoint[] | undefined
  period: 30 | 90
  onPeriodChange: (period: 30 | 90) => void
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg">
      <p className="text-xs text-zinc-400">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

export function InvestigationTrendChart({
  data,
  period,
  onPeriodChange,
}: InvestigationTrendChartProps) {
  const chartData = (data ?? []).map((d) => ({
    ...d,
    dateLabel: formatDateLabel(d.date),
  }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Investigation Trend</CardTitle>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={period === 30 ? 'secondary' : 'ghost'}
            onClick={() => onPeriodChange(30)}
          >
            30d
          </Button>
          <Button
            size="sm"
            variant={period === 90 ? 'secondary' : 'ghost'}
            onClick={() => onPeriodChange(90)}
          >
            90d
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-zinc-500">No data for this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <XAxis
                dataKey="dateLabel"
                stroke="#4B5563"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#4B5563"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                name="Total"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke="#14B8A6"
                fill="#14B8A6"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
