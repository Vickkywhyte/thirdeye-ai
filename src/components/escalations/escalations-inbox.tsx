'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type LegacyColumnDef } from '@tanstack/react-table/legacy'
import { Flag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ClientDate } from '@/components/shared/client-date'
import { ResolveEscalationDialog } from '@/components/escalations/resolve-escalation-dialog'
import { hasPermission } from '@/lib/auth/rbac'
import type { UserRole } from '@/types/database'

type Escalation = {
  id: string
  investigation_id: string
  escalated_by: string
  assigned_to: string | null
  status: 'open' | 'resolved'
  reason: string
  resolution_notes: string | null
  resolved_at: string | null
  created_at: string
}

type EnrichedEscalation = Escalation & {
  entity_name: string | null
  assigned_to_name: string | null
  escalated_by_name: string | null
}

const STATUS_STYLES: Record<Escalation['status'], string> = {
  open: 'border-red-500/30 bg-red-500/10 text-red-400',
  resolved: 'border-risk-low/30 bg-risk-low/10 text-risk-low',
}

type StatusFilter = 'all' | 'open' | 'resolved'

export function EscalationsInbox({
  userRole,
  userDirectory,
  entityDirectory,
}: {
  userRole: UserRole
  userDirectory: Record<string, string>
  entityDirectory: Record<string, { entityName: string }>
}) {
  const router = useRouter()
  const [escalations, setEscalations] = useState<EnrichedEscalation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')

  const canResolve = hasPermission(userRole, 'escalations:resolve')

  const loadEscalations = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    params.set('limit', '100')
    const res = await fetch(`/api/escalations?${params.toString()}`)
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new Error(json?.error ?? 'Failed to load escalations')
    }
    const json = await res.json()
    const list: Escalation[] = json.data?.escalations ?? []
    const enriched: EnrichedEscalation[] = list.map((e) => ({
      ...e,
      entity_name: entityDirectory[e.investigation_id]?.entityName ?? null,
      assigned_to_name: e.assigned_to ? userDirectory[e.assigned_to] ?? null : null,
      escalated_by_name: userDirectory[e.escalated_by] ?? null,
    }))
    return enriched
  }, [statusFilter, userDirectory, entityDirectory])

  useEffect(() => {
    const controller = new AbortController()
    loadEscalations()
      .then((next) => {
        if (controller.signal.aborted) return
        setEscalations(next)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load escalations')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [loadEscalations])

  async function refresh() {
    try {
      const next = await loadEscalations()
      setEscalations(next)
      setError(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reload escalations')
    }
  }

  const columns: LegacyColumnDef<EnrichedEscalation>[] = [
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
      accessorKey: 'entity_name',
      header: 'Investigation',
      cell: ({ row }) => (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 font-medium text-foreground hover:text-accent-blue"
          onClick={() =>
            router.push(`/investigations/${row.original.investigation_id}`)
          }
        >
          {row.original.entity_name ?? 'Unknown entity'}
        </Button>
      ),
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => (
        <p className="max-w-md truncate text-sm text-muted-foreground">
          {row.original.reason}
        </p>
      ),
    },
    {
      accessorKey: 'assigned_to_name',
      header: 'Assigned To',
      cell: ({ row }) =>
        row.original.assigned_to_name ? (
          <span className="text-sm">{row.original.assigned_to_name}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={`gap-1 text-[11px] ${STATUS_STYLES[row.original.status]}`}
        >
          {row.original.status === 'open' ? 'Open' : 'Resolved'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              router.push(`/investigations/${row.original.investigation_id}`)
            }
          >
            Open
          </Button>
          {row.original.status === 'open' && canResolve && (
            <ResolveEscalationDialog
              escalationId={row.original.id}
              onResolved={refresh}
            />
          )}
        </div>
      ),
    },
  ]

  const openCount = escalations.filter((e) => e.status === 'open').length

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
          <h1 className="text-2xl font-bold tracking-tight">Escalations</h1>
          <p className="text-muted-foreground">
            Investigations flagged for senior review
          </p>
        </div>
        <div className="flex items-center gap-3">
          {statusFilter !== 'resolved' && openCount > 0 && (
            <Badge
              variant="outline"
              className="border-red-500/30 bg-red-500/10 text-red-400"
            >
              {openCount} open
            </Badge>
          )}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {escalations.length === 0 ? (
        <EmptyState
          icon={Flag}
          title={
            statusFilter === 'open'
              ? 'No open escalations'
              : statusFilter === 'resolved'
                ? 'No resolved escalations yet'
                : 'No escalations'
          }
          description={
            statusFilter === 'open'
              ? 'Everything is clear — no investigations currently need senior review.'
              : 'Escalations will appear here once created from an investigation.'
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={escalations}
          searchable
          searchPlaceholder="Search escalations…"
        />
      )}
    </div>
  )
}
