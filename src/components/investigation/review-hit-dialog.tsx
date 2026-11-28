'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardEdit, Loader2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { HitDisposition } from '@/lib/validation/schemas'

type ReviewableDisposition = Exclude<HitDisposition, 'unreviewed'>

const DISPOSITION_OPTIONS: Array<{
  value: ReviewableDisposition
  label: string
  description: string
  tone: string
}> = [
  {
    value: 'confirmed',
    label: 'Confirmed',
    description: 'This is a true match — the same person or entity.',
    tone: 'text-risk-critical',
  },
  {
    value: 'false_positive',
    label: 'False Positive',
    description: 'Clearly a different person or entity. Discount.',
    tone: 'text-risk-low',
  },
  {
    value: 'needs_review',
    label: 'Needs Review',
    description: 'Requires senior sign-off before dispositioning.',
    tone: 'text-risk-medium',
  },
  {
    value: 'unable_to_determine',
    label: 'Unable to Determine',
    description: 'Insufficient evidence either way.',
    tone: 'text-muted-foreground',
  },
  {
    value: 'not_applicable',
    label: 'Not Applicable',
    description: 'Hit belongs to a different scope (e.g. historic record).',
    tone: 'text-muted-foreground',
  },
]

interface Props {
  hitId: string
  currentDisposition: HitDisposition
  source: string
  matchedName: string | null
}

export function ReviewHitDialog({
  hitId,
  currentDisposition,
  source,
  matchedName,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [disposition, setDisposition] = useState<ReviewableDisposition | ''>(
    currentDisposition === 'unreviewed' ? '' : currentDisposition
  )
  const [rationale, setRationale] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rationaleValid = rationale.trim().length >= 20

  function reset() {
    setDisposition(
      currentDisposition === 'unreviewed' ? '' : currentDisposition
    )
    setRationale('')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    setOpen(next)
  }

  async function handleSubmit() {
    if (!disposition) {
      setError('Select a disposition.')
      return
    }
    if (!rationaleValid) {
      setError('Rationale must be at least 20 characters.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/screening/hits/${hitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition, rationale }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? 'Failed to record review.')
        return
      }
      setOpen(false)
      reset()
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ClipboardEdit className="h-3.5 w-3.5" />
          {currentDisposition === 'unreviewed' ? 'Review Hit' : 'Update Review'}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Screening Hit</DialogTitle>
          <DialogDescription>
            Record your compliance judgment for this hit. Rationale is required
            and immutably logged to the investigation timeline and audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{source}</span>
              {matchedName && <span className="truncate">{matchedName}</span>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="disposition">Disposition</Label>
            <Select
              value={disposition}
              onValueChange={(v) => setDisposition(v as ReviewableDisposition)}
            >
              <SelectTrigger id="disposition">
                <SelectValue placeholder="Select a disposition…" />
              </SelectTrigger>
              <SelectContent>
                {DISPOSITION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span className={opt.tone}>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hit-rationale">
              Rationale
              <span className="ml-1 text-xs text-muted-foreground">
                (min. 20 characters)
              </span>
            </Label>
            <Textarea
              id="hit-rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Explain why this disposition fits — the match strength, supporting identifiers, and any corroborating evidence…"
              rows={5}
              maxLength={5000}
            />
            <p
              className={cn(
                'text-right text-xs',
                rationaleValid ? 'text-muted-foreground' : 'text-destructive'
              )}
            >
              {rationale.trim().length} / 20 min
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
            disabled={submitting || !disposition || !rationaleValid}
          >
            {submitting && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Save Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const DISPOSITION_BADGE_STYLES: Record<HitDisposition, string> = {
  unreviewed: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  confirmed: 'border-risk-critical/30 bg-risk-critical/10 text-risk-critical',
  false_positive: 'border-risk-low/30 bg-risk-low/10 text-risk-low',
  needs_review: 'border-risk-medium/30 bg-risk-medium/10 text-risk-medium',
  unable_to_determine: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  not_applicable: 'border-muted-foreground/30 bg-muted text-muted-foreground',
}

const DISPOSITION_LABELS: Record<HitDisposition, string> = {
  unreviewed: 'Unreviewed',
  confirmed: 'Confirmed',
  false_positive: 'False Positive',
  needs_review: 'Needs Review',
  unable_to_determine: 'Unable to Determine',
  not_applicable: 'Not Applicable',
}

export function DispositionBadge({ disposition }: { disposition: HitDisposition }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        DISPOSITION_BADGE_STYLES[disposition]
      )}
    >
      {DISPOSITION_LABELS[disposition]}
    </span>
  )
}
