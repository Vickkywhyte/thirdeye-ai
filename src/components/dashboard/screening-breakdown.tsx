'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ScreeningBreakdown as ScreeningBreakdownType } from '@/lib/analytics/queries'

interface ScreeningBreakdownProps {
  data: ScreeningBreakdownType | undefined
}

const CATEGORY_COLORS: Record<string, string> = {
  Sanctions: '#EF4444',
  PEP: '#F97316',
  'Adverse Media': '#EAB308',
  Registry: '#3B82F6',
}

export function ScreeningBreakdown({ data }: ScreeningBreakdownProps) {
  if (!data) return null

  const chartData = [
    { name: 'Sanctions', value: data.sanctions },
    { name: 'PEP', value: data.pep },
    { name: 'Adverse Media', value: data.adverseMedia },
    { name: 'Registry', value: data.registry },
  ]

  const hasData = chartData.some((d) => d.value > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Screening Hits by Type</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-zinc-500">No screening hits recorded</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" barSize={24}>
              <XAxis type="number" stroke="#4B5563" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#4B5563"
                tick={{ fontSize: 12, fill: '#D1D5DB' }}
                width={110}
              />
              <Tooltip
                contentStyle={{
                  background: '#18181B',
                  border: '1px solid #3F3F46',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
              <Bar dataKey="value" name="Hits" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#9CA3AF', fontSize: 12 }}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={CATEGORY_COLORS[entry.name] ?? '#6B7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
