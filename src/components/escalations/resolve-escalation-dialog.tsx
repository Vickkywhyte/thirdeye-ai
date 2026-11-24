'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Props {
  escalationId: string
  onResolved: () => void | Promise<void>
}

export function ResolveEscalationDialog({ escalationId, onResolved }: Props) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const notesValid = notes.trim().length >= 20

  function reset() {
    setNotes('')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    setOpen(next)
  }

  async function handleSubmit() {
    if (!notesValid) {
      setError('Resolution notes must be at least 20 characters.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/escalations/${escalationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_notes: notes }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? 'Failed to resolve escalation.')
        return
      }
      setOpen(false)
      reset()
      await onResolved()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-risk-low/40 text-risk-low hover:bg-risk-low/10"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Resolve
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve Escalation</DialogTitle>
          <DialogDescription>
            Record the outcome and reasoning. The escalation closes and a
            timeline entry is appended to the investigation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="resolution-notes">
              Resolution Notes
              <span className="ml-1 text-xs text-muted-foreground">
                (min. 20 characters)
              </span>
            </Label>
            <Textarea
              id="resolution-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Summarise the resolution and any follow-up actions…"
              rows={5}
              maxLength={5000}
            />
            <p
              className={cn(
                'text-right text-xs',
                notesValid ? 'text-muted-foreground' : 'text-destructive'
              )}
            >
              {notes.trim().length} / 20 min
            </p>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !notesValid}
          >
            {submitting && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Resolve Escalation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
