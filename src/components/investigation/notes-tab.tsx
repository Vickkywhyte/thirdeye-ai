'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/empty-state'
import { ClientDate } from '@/components/shared/client-date'

interface Note {
  id: string
  content: string
  author_id: string
  author_name: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]!.toUpperCase()
  return (parts[0][0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function NotesTab({ investigationId }: { investigationId: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/investigations/${investigationId}/notes`)
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.error ?? `Failed to load notes (HTTP ${res.status})`)
        return
      }
      const json = await res.json()
      setNotes(json.data ?? [])
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [investigationId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  async function saveNote() {
    const content = draft.trim()
    if (!content || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/investigations/${investigationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.error ?? `Failed to save note (HTTP ${res.status})`)
        return
      }
      const json = await res.json()
      setNotes((prev) => [json.data, ...prev])
      setDraft('')
    } finally {
      setSaving(false)
    }
  }

  // Cmd/Ctrl+Enter submits, matching Slack/Linear conventions.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      saveNote()
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a note. Ctrl+Enter to save."
          rows={3}
          className="resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-zinc-500">
            {draft.length > 0 && `${draft.length} characters`}
          </p>
          <Button
            size="sm"
            onClick={saveNote}
            disabled={saving || draft.trim().length === 0}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Save Note
              </>
            )}
          </Button>
        </div>
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
      ) : notes.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No notes yet"
          description="Analyst notes appear here. Capture findings, follow-ups, and context that doesn't fit elsewhere."
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-zinc-800 text-xs text-zinc-300">
                  {initialsFrom(note.author_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium text-zinc-200">
                    {note.author_name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    <ClientDate date={note.created_at} variant="relative" />
                  </p>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-300">
                  {note.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
