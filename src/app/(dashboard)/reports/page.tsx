'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type LegacyColumnDef } from '@tanstack/react-table/legacy'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ReportStatusBadge } from '@/components/reports/report-status-badge'
import { ReportPreview } from '@/components/reports/report-preview'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Eye, FileText, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { ClientDate } from '@/components/shared/client-date'

interface Report {
  id: string
  title: string
  template: string
  status: string
  investigation_id: string
  content: Record<string, unknown> | null
  created_at: string
}

interface Investigation {
  id: string
  entity_name: string
}

const TEMPLATE_LABELS: Record<string, string> = {
  standard_dd: 'Full DD',
  enhanced_dd: 'Enhanced DD',
  sanctions_alert: 'Screening Summary',
  periodic_review: 'Adverse Media',
}

const TEMPLATE_OPTIONS = [
  { value: 'standard_dd', label: 'Full Due Diligence' },
  { value: 'enhanced_dd', label: 'Enhanced Due Diligence' },
  { value: 'sanctions_alert', label: 'Screening Summary' },
  { value: 'periodic_review', label: 'Periodic Review' },
]

export default function ReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<Report | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [selectedInvestigation, setSelectedInvestigation] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('standard_dd')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const fetchInvestigations = useCallback(async () => {
    try {
      const res = await fetch('/api/investigations?limit=100')
      if (res.ok) {
        const json = await res.json()
        setInvestigations(
          (json.data?.investigations ?? []).map(
            (inv: { id: string; entity?: { name?: string } }) => ({
              id: inv.id,
              entity_name: inv.entity?.name ?? 'Unknown entity',
            })
          )
        )
      }
    } catch {
      // ignore
    }
  }, [])

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

  async function handleOpenDialog() {
    setDialogOpen(true)
    setSelectedInvestigation('')
    setSelectedTemplate('standard_dd')
    setCreateError(null)
    await fetchInvestigations()
  }

  async function handleCreateReport() {
    if (!selectedInvestigation) {
      setCreateError('Please select an investigation.')
      return
    }
    setCreating(true)
    setCreateError(null)
    const selectedInv = investigations.find((i) => i.id === selectedInvestigation)
    const templateLabel = TEMPLATE_LABELS[selectedTemplate] ?? selectedTemplate
    const title = `${templateLabel} — ${selectedInv?.entity_name ?? 'Unknown'}`
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investigationId: selectedInvestigation,
          template: selectedTemplate,
          title,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCreateError(json?.error ?? 'Failed to create report')
        return
      }
      const reportId = json.data?.report?.id
      setDialogOpen(false)
      if (reportId) {
        router.push(`/reports/${reportId}`)
      } else {
        fetchReports()
      }
    } catch {
      setCreateError('Network error — please try again.')
    } finally {
      setCreating(false)
    }
  }

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
        <span className="font-medium text-foreground">{row.original.title}</span>
      ),
    },
    {
      accessorKey: 'template',
      header: 'Template',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
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
        <span className="text-muted-foreground text-xs">
          <ClientDate date={row.original.created_at} />
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
            onClick={() => router.push(`/reports/${row.original.id}`)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPreview(row.original)}
            title="Quick preview"
          >
            <FileText className="h-3.5 w-3.5" />
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
            className="text-destructive hover:text-destructive/80"
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

  const newReportButton = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button onClick={handleOpenDialog}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Due Diligence Report</DialogTitle>
          <DialogDescription>
            Select an investigation and template. The AI will draft a formal
            narrative from screening results.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Investigation</label>
            <Select
              value={selectedInvestigation}
              onValueChange={setSelectedInvestigation}
              disabled={investigations.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    investigations.length === 0
                      ? 'Loading investigations…'
                      : 'Select investigation'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {investigations.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.entity_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Template</label>
            <Select
              value={selectedTemplate}
              onValueChange={setSelectedTemplate}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {createError && (
            <p className="text-xs text-destructive">{createError}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDialogOpen(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreateReport} disabled={creating || !selectedInvestigation}>
            {creating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and manage due diligence reports
          </p>
        </div>
        {newReportButton}
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="Create your first due diligence report from an investigation."
          action={newReportButton}
        />
      ) : (
        <div className="flex gap-4">
          <div className={preview ? 'w-1/2' : 'w-full'}>
            <DataTable columns={columns} data={reports} searchable searchPlaceholder="Search reports…" />
          </div>
          {preview && (
            <div className="w-1/2 rounded-lg border border-border bg-card">
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
