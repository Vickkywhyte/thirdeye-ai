'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Eye,
  TrendingUp,
} from 'lucide-react'
import type { DashboardMetrics } from '@/lib/analytics/queries'

interface MetricsStripProps {
  metrics: DashboardMetrics | undefined
  isLoading: boolean
}

function riskColor(score: number): string {
  if (score >= 80) return 'text-red-400'
  if (score >= 60) return 'text-orange-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-green-400'
}

const CARDS = [
  {
    key: 'totalInvestigations' as const,
    label: 'Total Investigations',
    icon: ClipboardList,
    color: 'text-blue-400',
  },
  {
    key: 'activeInvestigations' as const,
    label: 'Active',
    icon: Eye,
    color: 'text-teal-400',
  },
  {
    key: 'completedThisMonth' as const,
    label: 'Completed This Month',
    icon: CheckCircle2,
    color: 'text-green-400',
  },
  {
    key: 'avgRiskScore' as const,
    label: 'Avg Risk Score',
    icon: BarChart3,
    color: 'dynamic',
  },
  {
    key: 'highRiskCount' as const,
    label: 'High Risk',
    icon: AlertTriangle,
    color: 'dynamic-red',
  },
  {
    key: 'pendingReviews' as const,
    label: 'Pending Reviews',
    icon: TrendingUp,
    color: 'text-purple-400',
  },
]

export function MetricsStrip({ metrics, isLoading }: MetricsStripProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {CARDS.map((card) => {
        const value = metrics[card.key]
        const Icon = card.icon

        let iconColor = card.color
        if (card.color === 'dynamic') iconColor = riskColor(value)
        if (card.color === 'dynamic-red')
          iconColor = value > 0 ? 'text-red-400' : 'text-zinc-500'

        return (
          <Card key={card.key}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${iconColor}`} />
                <span className="text-xs text-zinc-500">{card.label}</span>
              </div>
              <p className={`mt-2 text-2xl font-bold ${iconColor}`}>
                {value}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
