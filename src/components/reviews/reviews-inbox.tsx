'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type LegacyColumnDef } from '@tanstack/react-table/legacy'
import { CalendarClock, CheckCircle2, Loader2, Play } from 'lucide-react'
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
import { hasPermission } from '@/lib/auth/rbac'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'

type ReviewStatus = 'pending' | 'in_progress' | 'completed' | 'overdue'

type Review = {
  id: string
  investigation_id: string
  status: ReviewStatus
  due_date: string
  completed_at: string | null
  completed_by: string | null
  source_id: string | null
  created_at: string
}

type EnrichedReview = Review & {
  entity_name: string | null
}

const STATUS_STYLES: Record<ReviewStatus, string> = {
  pending: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  in_progress: 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue',
  completed: 'border-risk-low/30 bg-risk-low/10 text-risk-low',
  overdue: 'border-red-500/30 bg-red-500/10 text-red-400',
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
}

type StatusFilter = 'all' | ReviewStatus

export function ReviewsInbox({
  userRole,
  entityDirectory,
}: {
  userRole: UserRole
  entityDirectory: Record<string, { entityName: string }>
}) {
  const router = useRouter()
  const [reviews, setReviews] = useState<EnrichedReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const canUpdate = hasPermission(userRole, 'reviews:update')

  const loadReviews = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    params.set('limit', '100')
    const res = await fetch(`/api/reviews?${params.toString()}`)
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new Error(json?.error ?? 'Failed to load reviews')
    }
    const json = await res.json()
    const list: Review[] = json.data?.reviews ?? []
    return list.map<EnrichedReview>((r) => ({
      ...r,
      entity_name: entityDirectory[r.investigation_id]?.entityName ?? null,
    }))
  }, [statusFilter, entityDirectory])

  useEffect(() => {
    const controller = new AbortController()
    loadReviews()
      .then((next) => {
        if (controller.signal.aborted) return
        setReviews(next)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load reviews')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [loadReviews])

  async function refresh() {
    try {
      const next = await loadReviews()
      setReviews(next)
      setError(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh')
    }
  }

  async function patch(id: string, status: 'in_progress' | 'completed') {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? `Failed to mark ${status}`)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to mark ${status}`)
    } finally {
      setBusyId(null)
    }
  }

  const columns: LegacyColumnDef<EnrichedReview>[] = [
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
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn('text-[11px]', STATUS_STYLES[row.original.status])}
        >
          {STATUS_LABEL[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: 'due_date',
      header: 'Due Date',
      cell: ({ row }) => (
        <span
          className={cn(
            'text-sm',
            row.original.status === 'overdue'
              ? 'text-red-400'
              : 'text-muted-foreground'
          )}
        >
          <ClientDate date={row.original.due_date} variant="date" />
        </span>
      ),
    },
    {
      accessorKey: 'completed_at',
      header: 'Completed At',
      cell: ({ row }) =>
        row.original.completed_at ? (
          <span className="text-sm text-muted-foreground">
            <ClientDate date={row.original.completed_at} />
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const r = row.original
        const busy = busyId === r.id
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                router.push(`/investigations/${r.investigation_id}`)
              }
            >
              Open
            </Button>
            {canUpdate && (r.status === 'pending' || r.status === 'overdue') && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                className="gap-1.5"
                onClick={() => patch(r.id, 'in_progress')}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Start Review
              </Button>
            )}
            {canUpdate && r.status === 'in_progress' && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                className="gap-1.5 border-risk-low/40 text-risk-low hover:bg-risk-low/10"
                onClick={() => patch(r.id, 'completed')}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Mark Completed
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const overdueCount = reviews.filter((r) => r.status === 'overdue').length

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
          <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
          <p className="text-muted-foreground">
            Scheduled periodic reviews across your investigations
          </p>
        </div>
        <div className="flex items-center gap-3">
          {overdueCount > 0 && (
            <Badge
              variant="outline"
              className="border-red-500/30 bg-red-500/10 text-red-400"
            >
              {overdueCount} overdue
            </Badge>
          )}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {reviews.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={
            statusFilter === 'overdue'
              ? 'No overdue reviews'
              : statusFilter === 'all'
                ? 'No reviews scheduled'
                : `No ${STATUS_LABEL[statusFilter].toLowerCase()} reviews`
          }
          description={
            statusFilter === 'all'
              ? 'Schedule a periodic review from any investigation to monitor it on a cadence.'
              : 'Reviews will appear here as their status changes.'
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={reviews}
          searchable
          searchPlaceholder="Search reviews…"
        />
      )}
    </div>
  )
}
