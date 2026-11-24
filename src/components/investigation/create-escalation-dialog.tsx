'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flag, Loader2 } from 'lucide-react'
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

export type ComplianceManager = {
  id: string
  full_name: string
}

const UNASSIGNED_VALUE = '__unassigned__'

interface Props {
  investigationId: string
  complianceManagers: ComplianceManager[]
}

export function CreateEscalationDialog({
  investigationId,
  complianceManagers,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [assignedTo, setAssignedTo] = useState<string>(UNASSIGNED_VALUE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reasonValid = reason.trim().length >= 20

  function reset() {
    setReason('')
    setAssignedTo(UNASSIGNED_VALUE)
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    setOpen(next)
  }

  async function handleSubmit() {
    if (!reasonValid) {
      setError('Reason must be at least 20 characters.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/investigations/${investigationId}/escalations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason,
            assigned_to:
              assignedTo === UNASSIGNED_VALUE ? null : assignedTo,
          }),
        }
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? 'Failed to create escalation.')
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
          className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Flag className="h-3.5 w-3.5" />
          Create Escalation
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Escalation</DialogTitle>
          <DialogDescription>
            Flag this investigation for senior review. The investigation moves
            to <span className="font-medium">escalated</span> status and a
            timeline entry is recorded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="assigned-to">
              Assign To
              <span className="ml-1 text-xs text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger id="assigned-to">
                <SelectValue placeholder="Compliance manager…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                {complianceManagers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {complianceManagers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No compliance managers configured yet.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="escalation-reason">
              Reason
              <span className="ml-1 text-xs text-muted-foreground">
                (min. 20 characters)
              </span>
            </Label>
            <Textarea
              id="escalation-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Summarise what triggered the escalation and what you need senior review on…"
              rows={5}
              maxLength={5000}
            />
            <p
              className={cn(
                'text-right text-xs',
                reasonValid ? 'text-muted-foreground' : 'text-destructive'
              )}
            >
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
            disabled={submitting || !reasonValid}
          >
            {submitting && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Escalate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
