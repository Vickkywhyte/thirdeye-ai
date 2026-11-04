'use client'

import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { relativeTime } from '@/lib/utils/formatting'
import type { RecentActivityItem } from '@/lib/analytics/queries'

interface RecentActivityProps {
  data: RecentActivityItem[] | undefined
}

const EVENT_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
  investigation_created: { icon: FileText, color: 'text-blue-400' },
  screening_completed: { icon: ShieldAlert, color: 'text-orange-400' },
  ai_analysis: { icon: Brain, color: 'text-purple-400' },
  status_changed: { icon: CheckCircle2, color: 'text-green-400' },
  screening_started: { icon: Search, color: 'text-teal-400' },
  note_added: { icon: FileText, color: 'text-zinc-400' },
  alert: { icon: AlertTriangle, color: 'text-red-400' },
}

function getEventConfig(eventType: string) {
  return EVENT_ICONS[eventType] ?? { icon: Activity, color: 'text-zinc-400' }
}

export function RecentActivity({ data }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <Link
          href="/investigations"
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          View Full Timeline
        </Link>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Clock className="h-8 w-8 text-zinc-600" />
            <p className="ml-3 text-sm text-zinc-500">No recent activity</p>
          </div>
        ) : (
          <div className="max-h-[400px] space-y-1 overflow-y-auto pr-1">
            {data.map((item) => {
              const config = getEventConfig(item.eventType)
              const Icon = config.icon

              return (
                <Link
                  key={item.id}
                  href={`/investigations/${item.investigationId}`}
                  className="flex items-start gap-3 rounded-md p-2.5 transition-colors hover:bg-zinc-900"
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 ${config.color}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-300">
                      <span className="font-medium">{item.entityName}</span>
                      {' — '}
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-0.5 text-xs text-zinc-500 truncate">
                        {item.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-zinc-600">
                      {relativeTime(item.createdAt)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
