'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Loader2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const PRESET_VALUE_CUSTOM = 'custom'

const PRESETS: Array<{ value: string; label: string; days: number }> = [
  { value: '30', label: '30 days (monthly)', days: 30 },
  { value: '90', label: '90 days (quarterly)', days: 90 },
  { value: '365', label: '365 days (annual)', days: 365 },
]

function formatPreviewDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function computePreviewFromDays(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

interface Props {
  investigationId: string
}

export function ScheduleReviewDialog({ investigationId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<string>('90')
  const [customDate, setCustomDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setPreset('90')
    setCustomDate('')
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    setOpen(next)
  }

  const isCustom = preset === PRESET_VALUE_CUSTOM
  const customIso = customDate ? new Date(customDate + 'T00:00:00Z').toISOString() : null
  const previewIso = isCustom
    ? customIso
    : computePreviewFromDays(Number(preset))

  const customValid = !isCustom || Boolean(customIso)

  async function handleSubmit() {
    if (isCustom && !customValid) {
      setError('Please choose a valid date.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const body = isCustom
        ? { due_date: customIso }
        : { due_in_days: Number(preset) }

      const res = await fetch(`/api/investigations/${investigationId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? 'Failed to schedule review.')
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
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10 hover:text-accent-blue"
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Schedule Review
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Periodic Review</DialogTitle>
          <DialogDescription>
            A review is added to the investigation calendar. If the due date
            passes without completion, the review is flagged as overdue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="review-preset">Interval</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger id="review-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value={PRESET_VALUE_CUSTOM}>Custom date…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCustom && (
            <div className="space-y-1.5">
              <Label htmlFor="review-custom-date">Custom Due Date</Label>
              <Input
                id="review-custom-date"
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          )}

          <p
            className={cn(
              'rounded-md border border-border bg-muted/30 px-3 py-2 text-xs',
              previewIso ? 'text-muted-foreground' : 'text-destructive'
            )}
          >
            Due{' '}
            <span className="font-medium text-foreground">
              {formatPreviewDate(previewIso)}
            </span>
          </p>

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
            disabled={submitting || (isCustom && !customValid)}
          >
            {submitting && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
