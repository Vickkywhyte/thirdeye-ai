'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Loader2, Send, Gavel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { ClientDate } from '@/components/shared/client-date'
import { RecordDecisionDialog } from '@/components/investigation/record-decision-dialog'

type Application = {
  id: string
  investigation_id: string
  status: 'draft' | 'submitted' | 'under_review' | 'decided'
  submitted_at: string | null
  created_at: string
  updated_at: string
}

type Decision = {
  id: string
  decision_type: 'approve' | 'reject' | 'refer'
  rationale: string
  decided_by: string
  source_id: string | null
  created_at: string
}

const STATUS_LABEL: Record<Application['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  decided: 'Decided',
}

const STATUS_STYLES: Record<Application['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-accent-blue/20 text-accent-blue',
  under_review: 'bg-risk-medium/20 text-risk-medium',
  decided: 'bg-risk-low/20 text-risk-low',
}

const DECISION_STYLES: Record<Decision['decision_type'], string> = {
  approve: 'bg-risk-low/20 text-risk-low',
  reject: 'bg-risk-critical/20 text-risk-critical',
  refer: 'bg-risk-medium/20 text-risk-medium',
}

export function ApplicationTab({
  investigationId,
}: {
  investigationId: string
}) {
  const router = useRouter()
  const [application, setApplication] = useState<Application | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadApplication = useCallback(
    async (opts: { signal?: AbortSignal } = {}) => {
      const res = await fetch(
        `/api/applications?investigation_id=${investigationId}`,
        { signal: opts.signal }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Failed to load application')
      }
      const json = await res.json()
      const next: Application | null = json.data.applications?.[0] ?? null
      let nextDecisions: Decision[] = []
      if (next) {
        const decRes = await fetch(`/api/applications/${next.id}/decisions`, {
          signal: opts.signal,
        })
        if (decRes.ok) {
          const decJson = await decRes.json()
          nextDecisions = decJson.data.decisions ?? []
        }
      }
      return { application: next, decisions: nextDecisions }
    },
    [investigationId]
  )

  async function refresh() {
    try {
      const result = await loadApplication()
      setApplication(result.application)
      setDecisions(result.decisions)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadApplication({ signal: controller.signal })
      .then((result) => {
        setApplication(result.application)
        setDecisions(result.decisions)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(
          err instanceof Error ? err.message : 'Failed to load application'
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [loadApplication])

  async function startApplication() {
    setStarting(true)
    setError(null)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investigation_id: investigationId,
          status: 'draft',
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Failed to start application')
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start application')
    } finally {
      setStarting(false)
    }
  }

  async function submitApplication() {
    if (!application) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'submitted' }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Failed to submit application')
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  async function onDecisionRecorded() {
    await refresh()
    // Refresh the server-rendered timeline on the parent page
    router.refresh()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    )
  }

  if (!application) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No onboarding application"
        description="Open an application to track this counterparty through submission and decision."
        action={
          <Button onClick={startApplication} disabled={starting}>
            {starting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Start Onboarding Application
          </Button>
        }
      />
    )
  }

  const canSubmit = application.status === 'draft'
  const canDecide =
    application.status === 'submitted' ||
    application.status === 'under_review' ||
    application.status === 'decided'

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Onboarding Application</CardTitle>
            </div>
            <Badge
              variant="secondary"
              className={STATUS_STYLES[application.status]}
            >
              {STATUS_LABEL[application.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">Opened</span>
              <span className="sm:ml-2">
                <ClientDate date={application.created_at} />
              </span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">Submitted</span>
              <span className="sm:ml-2">
                {application.submitted_at ? (
                  <ClientDate date={application.submitted_at} />
                ) : (
                  '—'
                )}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {canSubmit && (
              <Button
                onClick={submitApplication}
                disabled={submitting}
                className="gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Application
              </Button>
            )}
            {canDecide && (
              <RecordDecisionDialog
                applicationId={application.id}
                onRecorded={onDecisionRecorded}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {decisions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Decision History</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {decisions.map((d) => (
              <div
                key={d.id}
                className="rounded-md border border-border p-3"
              >
                <div className="flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    className={DECISION_STYLES[d.decision_type]}
                  >
                    {d.decision_type.charAt(0).toUpperCase() +
                      d.decision_type.slice(1)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    <ClientDate date={d.created_at} />
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {d.rationale}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
