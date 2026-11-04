'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Loader2, X, AlertCircle } from 'lucide-react'

interface ReportPreviewProps {
  reportId: string
  investigationId: string
  template: string
  title: string
  onClose: () => void
}

export function ReportPreview({
  reportId,
  investigationId,
  template,
  title,
  onClose,
}: ReportPreviewProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch(
          `/api/reports/${reportId}/preview?investigationId=${investigationId}&template=${template}`
        )
        if (res.ok) {
          const json = await res.json()
          setHtml(json.data?.html ?? null)
        } else {
          setError('Failed to load preview')
        }
      } catch {
        setError('Failed to load preview')
      } finally {
        setLoading(false)
      }
    }

    fetchPreview()
  }, [reportId, investigationId, template])

  async function handleDownload() {
    setDownloading(true)
    try {
      const genRes = await fetch(`/api/reports/${reportId}/generate`, {
        method: 'POST',
      })
      if (!genRes.ok) {
        const json = await genRes.json()
        setError(json.error ?? 'Generation failed')
        return
      }
      const json = await genRes.json()
      if (json.data?.url) {
        window.open(json.data.url, '_blank')
      }
    } catch {
      setError('Download failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-200 truncate">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Download PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="mt-3 text-sm text-red-400">{error}</p>
          </div>
        )}

        {html && !loading && (
          <iframe
            srcDoc={html}
            sandbox="allow-same-origin"
            className="h-full w-full border-0"
            title="Report Preview"
          />
        )}
      </div>
    </div>
  )
}
