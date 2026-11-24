'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, Loader2 } from 'lucide-react'
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

const RISK_LEVELS = [
  { value: 'low',      label: 'Low',      color: 'text-green-500' },
  { value: 'medium',   label: 'Medium',   color: 'text-yellow-500' },
  { value: 'high',     label: 'High',     color: 'text-orange-500' },
  { value: 'critical', label: 'Critical', color: 'text-red-500' },
]

interface Props {
  investigationId: string
}

export function RiskOverrideDialog({ investigationId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [riskLevel, setRiskLevel] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reasonValid = reason.trim().length >= 20

  async function handleSubmit() {
    if (!riskLevel) {
      setError('Please select a risk level.')
      return
    }
    if (!reasonValid) {
      setError('Justification must be at least 20 characters.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/investigations/${investigationId}/risk-override`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ riskLevel, reason }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error ?? 'Failed to save override.')
        return
      }
      setOpen(false)
      setRiskLevel('')
      setReason('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setRiskLevel('')
      setReason('')
      setError(null)
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5" />
          Override Risk
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override Risk Score</DialogTitle>
          <DialogDescription>
            Human overrides supersede the AI-generated score. Your decision and
            justification will be recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="risk-level">New Risk Level</Label>
            <Select value={riskLevel} onValueChange={setRiskLevel}>
              <SelectTrigger id="risk-level">
                <SelectValue placeholder="Select risk level" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <span className={level.color}>{level.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">
              Justification for Override
              <span className="ml-1 text-xs text-muted-foreground">
                (min. 20 characters)
              </span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear compliance justification for this override…"
              rows={4}
              maxLength={2000}
            />
            <p className={`text-right text-xs ${reasonValid ? 'text-muted-foreground' : 'text-destructive'}`}>
              {reason.trim().length} / 20 min
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
            disabled={submitting || !riskLevel || !reasonValid}
          >
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Confirm Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
