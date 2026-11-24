'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ReportStatusBadge } from '@/components/reports/report-status-badge'
import { ArrowLeft, Download, Loader2, RefreshCw } from 'lucide-react'

interface Props {
  reportId: string
  title: string
  template: string
  status: string
  investigationId: string
  content: Record<string, unknown> | null
}

export function ReportViewerClient({
  reportId,
  title,
  status: initialStatus,
  investigationId,
  content: initialContent,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState(initialStatus)

  const fetchPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/${reportId}/preview`)
      if (!res.ok) {
        setError('Failed to load report preview.')
        return
      }
      const json = await res.json()
      setHtml(json.data?.html ?? null)
    } catch {
      setError('Network error loading report.')
    } finally {
      setLoading(false)
    }
  }, [reportId])

  // Poll while report is generating
  useEffect(() => {
    const content = initialContent as Record<string, unknown> | null
    if (content?.status === 'generating' || status === 'in_review') {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/reports/${reportId}/preview`)
          if (res.ok) {
            const json = await res.json()
            if (json.data?.html) {
              setHtml(json.data.html)
              setStatus('final')
              setLoading(false)
              clearInterval(interval)
            }
          }
        } catch {
          // ignore poll errors
        }
      }, 3000)
      return () => clearInterval(interval)
    }

    fetchPreview()
  }, [reportId, initialContent, status, fetchPreview])

  function handlePrint() {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print()
    } else {
      // fallback: open in new tab
      const blob = new Blob([html ?? ''], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      win?.print()
    }
  }

  const isGenerating =
    status === 'in_review' ||
    (initialContent as Record<string, unknown> | null)?.status === 'generating'

  return (
    <>
      {/* Print-hidden toolbar */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/reports">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              All Reports
            </Link>
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{title}</h1>
            <div className="mt-0.5 flex items-center gap-2">
              <ReportStatusBadge status={status} />
              <Link
                href={`/investigations/${investigationId}`}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View investigation
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPreview}
            disabled={loading || isGenerating}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            disabled={!html || isGenerating}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Report content */}
      <div className="print:m-0 mx-auto max-w-5xl px-6 py-8">
        {isGenerating && !html && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              Generating AI narrative…
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              This takes 15–30 seconds
            </p>
          </div>
        )}

        {loading && !isGenerating && (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchPreview}
            >
              Try again
            </Button>
          </div>
        )}

        {html && !loading && (
          <>
            {/* A4-style container visible on screen */}
            <div className="print:hidden overflow-hidden rounded-lg border border-border shadow-lg">
              <iframe
                ref={iframeRef}
                srcDoc={html}
                title={title}
                className="h-[calc(100vh-180px)] w-full"
                style={{ minHeight: '600px' }}
              />
            </div>

            {/* On print: render raw HTML via iframe print (handled in handlePrint) */}
            <style>{`
              @media print {
                body > * { display: none !important; }
                body > #__next { display: none !important; }
              }
            `}</style>
          </>
        )}
      </div>
    </>
  )
}
