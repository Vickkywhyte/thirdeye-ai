'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/shared/data-table'
import { RiskScoreRing } from '@/components/investigation/risk-score-ring'
import { formatDate } from '@/lib/utils/formatting'

type InvestigationRow = {
  id: string
  status: string
  risk_score: number | null
  assigned_to: string | null
  updated_at: string
  entity: {
    id: string
    name: string
    type: string
    jurisdiction: string | null
  }
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-accent-blue/20 text-accent-blue',
  pending_review: 'bg-risk-medium/20 text-risk-medium',
  completed: 'bg-risk-low/20 text-risk-low',
  escalated: 'bg-risk-critical/20 text-risk-critical',
  archived: 'bg-muted text-muted-foreground',
}

const columns: LegacyColumnDef<InvestigationRow, unknown>[] = [
  {
    accessorFn: (row) => row.entity.name,
    id: 'entity_name',
    header: 'Entity',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.entity.name}</p>
        <p className="text-xs capitalize text-muted-foreground">
          {row.original.entity.type}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'risk_score',
    header: 'Risk',
    cell: ({ row }) =>
      row.original.risk_score != null ? (
        <RiskScoreRing score={row.original.risk_score} size="sm" />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={STATUS_COLORS[row.original.status] ?? ''}
      >
        {row.original.status.replace('_', ' ')}
      </Badge>
    ),
  },
  {
    accessorFn: (row) => row.entity.jurisdiction,
    id: 'jurisdiction',
    header: 'Jurisdiction',
    cell: ({ row }) =>
      row.original.entity.jurisdiction ?? (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: 'updated_at',
    header: 'Last Updated',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.updated_at)}
      </span>
    ),
  },
]

export default function InvestigationsPage() {
  const router = useRouter()
  const [data, setData] = useState<InvestigationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const fetchInvestigations = useCallback(async () => {
    setIsLoading(true)
    const supabase = createClient()
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (search) params.set('search', search)

    const res = await fetch(`/api/investigations?${params.toString()}`)
    if (res.ok) {
      const json = await res.json()
      setData(json.data.investigations)
    }
    setIsLoading(false)
    void supabase
  }, [statusFilter, search])

  useEffect(() => {
    fetchInvestigations()
  }, [fetchInvestigations])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investigations</h1>
          <p className="text-muted-foreground">
            Manage your due diligence investigations
          </p>
        </div>
        <Button onClick={() => router.push('/investigations/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Investigation
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search entities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/investigations/${row.id}`)}
      />
    </div>
  )
}
