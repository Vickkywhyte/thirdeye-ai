'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Download,
  FileText,
  Loader2,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { ClientDate } from '@/components/shared/client-date'
import { cn } from '@/lib/utils'

interface Document {
  id: string
  file_name: string
  file_type: string
  file_size_bytes: number | null
  uploaded_by: string
  uploaded_by_name: string | null
  created_at: string
}

const MAX_SIZE = 25 * 1024 * 1024

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function DocumentsTab({ investigationId }: { investigationId: string }) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/investigations/${investigationId}/documents`)
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.error ?? `Failed to load documents (HTTP ${res.status})`)
        return
      }
      const json = await res.json()
      setDocuments(json.data ?? [])
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [investigationId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null)
      // Client-side size guard mirrors the server check, so the user sees the
      // problem before uploading 25 MB of nothing.
      if (file.size > MAX_SIZE) {
        setError(`File exceeds ${MAX_SIZE / 1024 / 1024} MB limit`)
        return
      }
      setUploading(true)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(
          `/api/investigations/${investigationId}/documents`,
          { method: 'POST', body: form }
        )
        if (!res.ok) {
          const json = await res.json().catch(() => null)
          setError(json?.error ?? `Upload failed (HTTP ${res.status})`)
          return
        }
        const json = await res.json()
        setDocuments((prev) => [json.data, ...prev])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [investigationId]
  )

  async function handleDelete(docId: string) {
    const prev = documents
    setDocuments((docs) => docs.filter((d) => d.id !== docId))
    const res = await fetch(
      `/api/investigations/${investigationId}/documents/${docId}`,
      { method: 'DELETE' }
    )
    if (!res.ok) {
      // Revert the optimistic removal on failure.
      setDocuments(prev)
      const json = await res.json().catch(() => null)
      setError(json?.error ?? 'Failed to delete document')
    }
  }

  async function handleDownload(doc: Document) {
    const res = await fetch(
      `/api/investigations/${investigationId}/documents/${doc.id}`
    )
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error ?? 'Failed to get download link')
      return
    }
    const json = await res.json()
    if (json.data?.url) window.open(json.data.url, '_blank', 'noopener')
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/30 p-8 text-center transition-colors',
          dragging && 'border-primary bg-primary/5',
          uploading && 'pointer-events-none opacity-70'
        )}
      >
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadFile(file)
            e.target.value = '' // allow re-upload of the same file
          }}
        />
        {uploading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-400">Uploading…</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-10 w-10 text-zinc-500" />
            <p className="mt-3 text-sm font-medium text-zinc-200">
              Drop a file here, or click to browse
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Maximum 25 MB per file
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={(e) => {
                e.stopPropagation()
                fileInput.current?.click()
              }}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Browse Files
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload certificates of incorporation, ID documents, financial statements and other supporting evidence."
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="bg-zinc-900/50">
              <CardContent className="flex items-start gap-3 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-800">
                  <FileText className="h-5 w-5 text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {doc.file_name}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {formatSize(doc.file_size_bytes)} ·{' '}
                    {doc.uploaded_by_name ?? 'Unknown'} ·{' '}
                    <ClientDate date={doc.created_at} />
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    aria-label="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc.id)}
                    aria-label="Delete"
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
