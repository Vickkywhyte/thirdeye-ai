'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { type LegacyColumnDef } from '@tanstack/react-table/legacy'
import type { RowData } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ReportStatusBadge } from '@/components/reports/report-status-badge'
import { ReportPreview } from '@/components/reports/report-preview'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Eye, FileText, Plus, Trash2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/formatting'

interface Report {
  id: string
  title: string
  template: string
  status: string
  investigation_id: string
  content: Record<string, unknown> | null
  created_at: string
}

const TEMPLATE_LABELS: Record<string, string> = {
  standard_dd: 'Full DD',
  enhanced_dd: 'Enhanced DD',
  sanctions_alert: 'Screening Summary',
  periodic_review: 'Adverse Media',
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<Report | null>(null)

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch('/api/reports')
      if (res.ok) {
        const json = await res.json()
        setReports(json.data?.reports ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  useEffect(() => {
    const hasGenerating = reports.some((r) => r.status === 'in_review')
    if (!hasGenerating) return

    const interval = setInterval(fetchReports, 3000)
    return () => clearInterval(interval)
  }, [reports, fetchReports])

  async function handleDelete(id: string) {
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== id))
    }
  }

  async function handleDownload(report: Report) {
    const content = report.content
    if (content?.status === 'ready') {
      window.open(`/api/reports/${report.id}/download`, '_blank')
    } else {
      const res = await fetch(`/api/reports/${report.id}/generate`, {
        method: 'POST',
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data?.url) {
          window.open(json.data.url, '_blank')
        }
        fetchReports()
      }
    }
  }

  const columns: LegacyColumnDef<Report>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <span className="font-medium text-zinc-200">{row.original.title}</span>
      ),
    },
    {
      accessorKey: 'template',
      header: 'Template',
      cell: ({ row }) => (
        <span className="text-zinc-400">
          {TEMPLATE_LABELS[row.original.template] ?? row.original.template}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <ReportStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-zinc-500 text-xs">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPreview(row.original)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDownload(row.original)}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:text-red-300"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
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
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and manage due diligence reports
          </p>
        </div>
        <Link href="/reports/new">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            New Report
          </Button>
        </Link>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="Create your first due diligence report from an investigation."
          action={
            <Link href="/reports/new">
              <Button>
                <Plus className="mr-1.5 h-4 w-4" />
                New Report
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex gap-4">
          <div className={preview ? 'w-1/2' : 'w-full'}>
            <DataTable columns={columns} data={reports} searchable searchPlaceholder="Search reports…" />
          </div>
          {preview && (
            <div className="w-1/2 rounded-lg border border-zinc-800 bg-zinc-950">
              <ReportPreview
                reportId={preview.id}
                investigationId={preview.investigation_id}
                template={preview.template}
                title={preview.title}
                onClose={() => setPreview(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
