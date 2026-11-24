'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Save,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/empty-state'
import { ClientDate } from '@/components/shared/client-date'
import { cn } from '@/lib/utils'
import {
  EDD_RISK_LEVELS,
  type UpsertEddInput,
} from '@/lib/validation/schemas'

type RiskLevel = (typeof EDD_RISK_LEVELS)[number]

type EddAssessment = {
  id: string
  investigation_id: string
  status: 'draft' | 'completed'
  risk_factors: Record<string, RiskLevel>
  notes: string | null
  completed_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

const RISK_FACTORS: Array<{ key: string; label: string; help: string }> = [
  {
    key: 'source_of_funds',
    label: 'Source of Funds',
    help: 'Origin of the money used in this relationship.',
  },
  {
    key: 'source_of_wealth',
    label: 'Source of Wealth',
    help: 'Overall economic footprint of the counterparty.',
  },
  {
    key: 'jurisdiction',
    label: 'Jurisdiction Risk',
    help: 'Country / regulatory regime where the counterparty operates.',
  },
  {
    key: 'ownership_complexity',
    label: 'Complex Ownership',
    help: 'Layered or opaque beneficial-owner structure.',
  },
  {
    key: 'business_nature',
    label: 'Business Nature',
    help: 'Industry, products, and customer base.',
  },
]

const RISK_OPTIONS: Array<{ value: RiskLevel; label: string; tone: string }> = [
  { value: 'low', label: 'Low', tone: 'text-risk-low' },
  { value: 'medium', label: 'Medium', tone: 'text-risk-medium' },
  { value: 'high', label: 'High', tone: 'text-risk-critical' },
]

const RISK_BADGE_STYLES: Record<RiskLevel, string> = {
  low: 'border-risk-low/30 bg-risk-low/10 text-risk-low',
  medium: 'border-risk-medium/30 bg-risk-medium/10 text-risk-medium',
  high: 'border-risk-critical/30 bg-risk-critical/10 text-risk-critical',
}

const STATUS_STYLES: Record<EddAssessment['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  completed: 'bg-risk-low/20 text-risk-low',
}

export function EddTab({
  investigationId,
  canEdit,
  onJumpToDocuments,
}: {
  investigationId: string
  canEdit: boolean
  onJumpToDocuments: () => void
}) {
  const router = useRouter()
  const [assessment, setAssessment] = useState<EddAssessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [riskFactors, setRiskFactors] = useState<Record<string, RiskLevel>>({})
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/investigations/${investigationId}/edd`)
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new Error(json?.error ?? 'Failed to load EDD assessment')
    }
    const json = await res.json()
    return (json.data as EddAssessment | null) ?? null
  }, [investigationId])

  useEffect(() => {
    const controller = new AbortController()
    load()
      .then((next) => {
        if (controller.signal.aborted) return
        setAssessment(next)
        setRiskFactors(next?.risk_factors ?? {})
        setNotes(next?.notes ?? '')
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(
          err instanceof Error ? err.message : 'Failed to load EDD assessment'
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [load])

  async function persist(body: UpsertEddInput) {
    const res = await fetch(`/api/investigations/${investigationId}/edd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(json?.error ?? 'Failed to save EDD assessment')
    }
    return json.data as EddAssessment
  }

  async function refresh() {
    try {
      const next = await load()
      setAssessment(next)
      setRiskFactors(next?.risk_factors ?? {})
      setNotes(next?.notes ?? '')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh')
    }
  }

  async function startAssessment() {
    setStarting(true)
    setError(null)
    try {
      const next = await persist({ status: 'draft', risk_factors: {} })
      setAssessment(next)
      setRiskFactors(next.risk_factors ?? {})
      setNotes(next.notes ?? '')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start EDD')
    } finally {
      setStarting(false)
    }
  }

  async function saveDraft() {
    if (!assessment) return
    setSaving(true)
    setError(null)
    try {
      const next = await persist({
        status: 'draft',
        risk_factors: riskFactors,
        notes: notes.trim() ? notes : null,
      })
      setAssessment(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function markCompleted() {
    if (!assessment) return
    setCompleting(true)
    setError(null)
    try {
      const next = await persist({
        status: 'completed',
        risk_factors: riskFactors,
        notes: notes.trim() ? notes : null,
      })
      setAssessment(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete EDD')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-lg" />
  }

  if (!assessment) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No EDD assessment yet"
        description="Open an enhanced-due-diligence assessment to capture risk-factor judgments, supporting notes, and sign-off."
        action={
          canEdit ? (
            <Button onClick={startAssessment} disabled={starting}>
              {starting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Start EDD Assessment
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ask an analyst, compliance manager, or admin to start one.
            </p>
          )
        }
      />
    )
  }

  const readOnly = !canEdit || assessment.status === 'completed'

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                Enhanced Due Diligence
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge
                variant="secondary"
                className={STATUS_STYLES[assessment.status]}
              >
                {assessment.status === 'completed' ? 'Completed' : 'Draft'}
              </Badge>
              {assessment.completed_at && (
                <span>
                  <ClientDate date={assessment.completed_at} />
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-medium">Risk Factors</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {RISK_FACTORS.map((factor) => {
                const value = riskFactors[factor.key]
                return (
                  <div
                    key={factor.key}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Label
                        htmlFor={`risk-${factor.key}`}
                        className="text-sm font-medium"
                      >
                        {factor.label}
                      </Label>
                      {value && (
                        <Badge
                          variant="outline"
                          className={cn('text-[10px]', RISK_BADGE_STYLES[value])}
                        >
                          {value}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {factor.help}
                    </p>
                    <Select
                      value={value ?? ''}
                      onValueChange={(v) => {
                        setRiskFactors((prev) => ({
                          ...prev,
                          [factor.key]: v as RiskLevel,
                        }))
                      }}
                      disabled={readOnly}
                    >
                      <SelectTrigger id={`risk-${factor.key}`} className="mt-3">
                        <SelectValue placeholder="Select risk level…" />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className={opt.tone}>{opt.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edd-notes" className="text-sm font-medium">
              Analyst Notes
            </Label>
            <Textarea
              id="edd-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Summarise the evidence, rationale, and any follow-up items for this EDD assessment…"
              rows={5}
              maxLength={10000}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Supporting Documents</h3>
            <div className="flex items-center justify-between rounded-md border border-dashed border-border p-3">
              <p className="text-xs text-muted-foreground">
                Attach signed KYC packs, statements, and corroborating evidence
                in the Documents tab.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={onJumpToDocuments}
              >
                <FileText className="h-3.5 w-3.5" />
                Open Documents
              </Button>
            </div>
          </div>

          {!readOnly && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={saveDraft}
                disabled={saving || completing}
                className="gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Draft
              </Button>
              <Button
                onClick={markCompleted}
                disabled={saving || completing}
                className="gap-1.5"
              >
                {completing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Mark as Completed
              </Button>
            </div>
          )}

          {canEdit && assessment.status === 'completed' && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-risk-low/30 bg-risk-low/5 px-3 py-2 text-xs">
              <p className="text-risk-low">
                EDD is sealed. Open a new assessment cycle to amend risk
                factors.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh}
                className="text-xs"
              >
                Refresh
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
