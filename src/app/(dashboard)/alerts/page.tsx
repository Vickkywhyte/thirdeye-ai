'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type LegacyColumnDef } from '@tanstack/react-table/legacy'
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  RefreshCw,
  Shield,
  ShieldAlert,
  Siren,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientDate } from '@/components/shared/client-date'
import { Radio } from 'lucide-react'

interface Alert {
  id: string
  event_type: string
  title: string
  description: string | null
  created_at: string
  investigation_id: string
  entity_name: string | null
}

const EVENT_TYPE_META: Record<string, { label: string; icon: React.ElementType; variant: string }> = {
  risk_override: {
    label: 'Risk Override',
    icon: ShieldAlert,
    variant: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
  },
  screening_completed: {
    label: 'Screening Complete',
    icon: Shield,
    variant: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  },
  child_investigation_opened: {
    label: 'Linked Investigation',
    icon: GitBranch,
    variant: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  },
  status_changed: {
    label: 'Status Change',
    icon: RefreshCw,
    variant: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  },
  escalated: {
    label: 'Escalated',
    icon: AlertTriangle,
    variant: 'border-red-500/30 bg-red-500/10 text-red-400',
  },
}

function AlertTypeBadge({ eventType }: { eventType: string }) {
  const meta = EVENT_TYPE_META[eventType] ?? {
    label: eventType.replace(/_/g, ' '),
    icon: AlertTriangle,
    variant: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  }
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={`gap-1 text-[11px] ${meta.variant}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  )
}

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts')
      if (res.ok) {
        const json = await res.json()
        setAlerts(json.data?.alerts ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  function handleResolve(id: string) {
    setResolvedIds((prev) => new Set([...prev, id]))
  }

  const visibleAlerts = alerts.filter((a) => !resolvedIds.has(a.id))

  const columns: LegacyColumnDef<Alert>[] = [
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          <ClientDate date={row.original.created_at} />
        </span>
      ),
    },
    {
      accessorKey: 'event_type',
      header: 'Alert Type',
      cell: ({ row }) => <AlertTypeBadge eventType={row.original.event_type} />,
    },
    {
      accessorKey: 'entity_name',
      header: 'Entity',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.entity_name ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Description',
      cell: ({ row }) => (
        <div className="max-w-xs">
          <p className="truncate text-sm text-foreground">{row.original.title}</p>
          {row.original.description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.description}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/investigations/${row.original.investigation_id}`)}
          >
            Review
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => handleResolve(row.original.id)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Resolve
          </Button>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground">
            Actionable events requiring human review
          </p>
        </div>
        {visibleAlerts.length > 0 && (
          <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400">
            {visibleAlerts.length} unresolved
          </Badge>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm">
        <Radio className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <p className="text-blue-300/80">
          <span className="font-medium text-blue-300">Alerts reflect manual screenings.</span>{' '}
          Continuous background monitoring with real-time push alerts is active for Phase 2.
        </p>
      </div>

      {visibleAlerts.length === 0 ? (
        <EmptyState
          icon={Siren}
          title="No pending alerts"
          description={
            resolvedIds.size > 0
              ? 'All alerts resolved. Great work!'
              : 'No actionable events found across your investigations.'
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={visibleAlerts}
          searchable
          searchPlaceholder="Search alerts…"
        />
      )}
    </div>
  )
}
