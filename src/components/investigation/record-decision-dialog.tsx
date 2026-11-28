'use client'

import { useState } from 'react'
import { Gavel, Loader2, CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
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
import { DECISION_TYPES } from '@/lib/validation/schemas'
import { SourcePicker } from '@/components/sources/source-picker'

type DecisionType = (typeof DECISION_TYPES)[number]

const DECISION_OPTIONS: Array<{
  value: DecisionType
  label: string
  description: string
  icon: typeof CheckCircle2
  tone: string
  activeTone: string
}> = [
  {
    value: 'approve',
    label: 'Approve',
    description: 'Onboard this counterparty',
    icon: CheckCircle2,
    tone: 'text-risk-low',
    activeTone:
      'border-risk-low/60 bg-risk-low/10 text-risk-low',
  },
  {
    value: 'reject',
    label: 'Reject',
    description: 'Decline the application',
    icon: XCircle,
    tone: 'text-risk-critical',
    activeTone:
      'border-risk-critical/60 bg-risk-critical/10 text-risk-critical',
  },
  {
    value: 'refer',
    label: 'Refer',
    description: 'Escalate to senior review',
    icon: HelpCircle,
    tone: 'text-risk-medium',
    activeTone:
      'border-risk-medium/60 bg-risk-medium/10 text-risk-medium',
  },
]

interface Props {
  applicationId: string
  onRecorded: () => void | Promise<void>
}

export function RecordDecisionDialog({ applicationId, onRecorded }: Props) {
  const [open, setOpen] = useState(false)
  const [decisionType, setDecisionType] = useState<DecisionType | ''>('')
  const [rationale, setRationale] = useState('')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rationaleValid = rationale.trim().length >= 20
  const sourceValid = !!sourceId

  function reset() {
    setDecisionType('')
    setRationale('')
    setSourceId(null)
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    setOpen(next)
  }

  async function handleSubmit() {
    if (!decisionType) {
      setError('Select a decision type.')
      return
    }
    if (!rationaleValid) {
      setError('Rationale must be at least 20 characters.')
      return
    }
    if (!sourceValid) {
      setError('Pick a source for provenance.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/applications/${applicationId}/decisions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision_type: decisionType,
            rationale,
            source_id: sourceId,
          }),
        }
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? 'Failed to record decision.')
        return
      }
      setOpen(false)
      reset()
      await onRecorded()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <Gavel className="h-4 w-4" />
          Record Decision
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Decision</DialogTitle>
          <DialogDescription>
            Decisions are immutable and appended to the investigation timeline
            with your name, the rationale, and a timestamp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Decision Type</Label>
            <div
              role="radiogroup"
              aria-label="Decision type"
              className="grid gap-2 sm:grid-cols-3"
            >
              {DECISION_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const active = decisionType === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDecisionType(opt.value)}
                    className={cn(
                      'flex flex-col items-start gap-1.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors',
                      active
                        ? opt.activeTone
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        active ? '' : opt.tone
                      )}
                    />
                    <span className="font-medium text-foreground">
                      {opt.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {opt.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rationale">
              Rationale
              <span className="ml-1 text-xs text-muted-foreground">
                (min. 20 characters)
              </span>
            </Label>
            <Textarea
              id="rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Summarise the evidence and reasoning behind this decision…"
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

          <div className="space-y-1.5">
            <Label htmlFor="decision-source">
              Evidence Source
              <span className="ml-1 text-xs text-destructive">*</span>
            </Label>
            <SourcePicker
              id="decision-source"
              value={sourceId}
              onChange={setSourceId}
              required
            />
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
            disabled={submitting || !decisionType || !rationaleValid || !sourceValid}
          >
            {submitting && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Record Decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
