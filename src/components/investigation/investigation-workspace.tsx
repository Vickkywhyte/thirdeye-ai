'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  GitBranch,
  Link2,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { RiskScoreRing, type ScoreBreakdownItem } from '@/components/investigation/risk-score-ring'
import {
  ScreeningResults,
  type ScreeningResult,
} from '@/components/investigation/screening-results'
import { AiAnalysisCard } from '@/components/investigation/ai-analysis-card'
import { ApplicationTab } from '@/components/investigation/application-tab'
import {
  CreateEscalationDialog,
  type ComplianceManager,
} from '@/components/investigation/create-escalation-dialog'
import { DocumentsTab } from '@/components/investigation/documents-tab'
import { EddTab } from '@/components/investigation/edd-tab'
import { NotesTab } from '@/components/investigation/notes-tab'
import { RiskOverrideDialog } from '@/components/investigation/risk-override-dialog'
import { ScheduleReviewDialog } from '@/components/investigation/schedule-review-dialog'
import { ClientDate } from '@/components/shared/client-date'
import { hasPermission } from '@/lib/auth/rbac'
import type { UserRole } from '@/types/database'

const RISK_WEIGHTS: Record<string, number> = {
  sanctions: 0.4,
  pep: 0.25,
  adverse_media: 0.2,
  registry: 0.15,
}

const RISK_LABELS: Record<string, string> = {
  sanctions: 'Sanctions',
  pep: 'PEP',
  adverse_media: 'Adverse Media',
  registry: 'Registry',
}

function computeScoreBreakdown(results: ScreeningResult[]): ScoreBreakdownItem[] {
  return results.map((result) => {
    const weight = RISK_WEIGHTS[result.type] ?? 0
    const hits = result.screening_hits ?? []
    const hitCount = result.hit_count

    if (hitCount === 0 || hits.length === 0) {
      return { label: RISK_LABELS[result.type] ?? result.type, contribution: 0, hitCount: 0 }
    }

    const maxHitScore = Math.max(...hits.map((h) => h.match_score))
    const logBoost = Math.min(1.5, 1 + Math.log2(hitCount) * 0.15)
    const typeScore = Math.min(100, maxHitScore * logBoost)
    const contribution = Math.round(typeScore * weight)

    return {
      label: RISK_LABELS[result.type] ?? result.type,
      contribution,
      hitCount,
    }
  })
}

const OwnershipGraph = dynamic(
  () =>
    import('@/components/graph/ownership-graph').then(
      (mod) => mod.OwnershipGraph
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[600px] w-full rounded-lg" />,
  }
)

export type InvestigationWorkspaceData = {
  id: string
  parent_investigation_id: string | null
  parent_entity_name: string | null
  status: string
  risk_score: number | null
  override_risk_score: number | null
  override_reason: string | null
  override_by: string | null
  override_by_name: string | null
  override_at: string | null
  assigned_to: string | null
  summary: string | null
  created_at: string
  updated_at: string
  entity: {
    id: string
    name: string
    type: string
    jurisdiction: string | null
    registration_number: string | null
    counterparty_type: string | null
  }
  screening_results: ScreeningResult[]
  timeline_events: Array<{
    id: string
    event_type: string
    title: string
    description: string | null
    created_at: string
  }>
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-accent-blue/20 text-accent-blue',
  pending_review: 'bg-risk-medium/20 text-risk-medium',
  completed: 'bg-risk-low/20 text-risk-low',
  escalated: 'bg-risk-critical/20 text-risk-critical',
  archived: 'bg-muted text-muted-foreground',
}

export function InvestigationWorkspace({
  investigation,
  userRole,
  complianceManagers,
}: {
  investigation: InvestigationWorkspaceData
  userRole: UserRole
  complianceManagers: ComplianceManager[]
}) {
  const entity = investigation.entity
  const screeningResults = investigation.screening_results ?? []
  const timelineEvents = investigation.timeline_events ?? []

  const scoreBreakdown = computeScoreBreakdown(screeningResults)
  const canEscalate = hasPermission(userRole, 'escalations:create')
  const canEditEdd = hasPermission(userRole, 'edd:update')
  const canScheduleReview = hasPermission(userRole, 'reviews:update')
  const [activeTab, setActiveTab] = useState('overview')

  // Transparency flag (Audit Item E): the registry provider tags its hit
  // with ownership_status='unavailable' when Companies House returns the
  // company itself but no PSCs / officers. Surface the gap on the
  // Overview tab so an analyst can't miss it before making a decision.
  const registryResult = screeningResults.find((r) => r.type === 'registry')
  const ownershipUnavailable = (registryResult?.screening_hits ?? []).some(
    (h) =>
      (h.data as { ownership_status?: string } | undefined)
        ?.ownership_status === 'unavailable'
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {entity.name}
            </h1>
            <Badge
              variant="secondary"
              className={STATUS_COLORS[investigation.status] ?? ''}
            >
              {investigation.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {entity.type} &middot;{' '}
            {entity.jurisdiction ?? 'No jurisdiction'} &middot; Created{' '}
            <ClientDate date={investigation.created_at} />
          </p>
          {investigation.parent_investigation_id && investigation.parent_entity_name && (
            <Link
              href={`/investigations/${investigation.parent_investigation_id}`}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Link2 className="h-3 w-3" />
              Linked to: {investigation.parent_entity_name}
            </Link>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {investigation.risk_score != null && (
            <RiskScoreRing
              score={investigation.risk_score}
              size="lg"
              breakdown={scoreBreakdown.length > 0 ? scoreBreakdown : undefined}
            />
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canScheduleReview && (
              <ScheduleReviewDialog investigationId={investigation.id} />
            )}
            {canEscalate && (
              <CreateEscalationDialog
                investigationId={investigation.id}
                complianceManagers={complianceManagers}
              />
            )}
            <RiskOverrideDialog investigationId={investigation.id} />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Building2 className="mr-1.5 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="screening">
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Screening
          </TabsTrigger>
          <TabsTrigger value="edd">
            <ClipboardList className="mr-1.5 h-4 w-4" />
            EDD
          </TabsTrigger>
          <TabsTrigger value="application">
            <ClipboardCheck className="mr-1.5 h-4 w-4" />
            Application
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-1.5 h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="ownership">
            <GitBranch className="mr-1.5 h-4 w-4" />
            Ownership
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="mr-1.5 h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="notes">
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          {investigation.override_risk_score != null && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3">
              <ShieldAlert className="h-4 w-4 shrink-0 text-orange-400" />
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-medium text-orange-300">Risk Overridden</span>
                {investigation.override_by_name && (
                  <span className="text-orange-300/80"> by {investigation.override_by_name}</span>
                )}
                {investigation.override_reason && (
                  <span className="ml-1 text-orange-300/60">— {investigation.override_reason}</span>
                )}
              </div>
              {investigation.override_at && (
                <span className="shrink-0 text-xs text-orange-400/60">
                  <ClientDate date={investigation.override_at} />
                </span>
              )}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Entity Summary</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{entity.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="capitalize">{entity.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Jurisdiction</span>
                  <span>{entity.jurisdiction ?? '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Registration No.</span>
                  <span>{entity.registration_number ?? '—'}</span>
                </div>
                {entity.counterparty_type && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Counterparty</span>
                    <span className="capitalize">
                      {entity.counterparty_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Risk Score</span>
                  <span>{investigation.risk_score ?? 'Not scored'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span><ClientDate date={investigation.created_at} /></span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {ownershipUnavailable && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-300">
                      UBO coverage gap
                    </p>
                    <p className="mt-0.5 text-xs text-amber-300/80">
                      Companies House returned no PSCs or officers for this
                      counterparty. Beneficial ownership is{' '}
                      <span className="font-medium">unverified</span> — treat
                      the ownership graph as incomplete and complete a manual
                      verification before approving.
                    </p>
                  </div>
                </div>
              )}
              <AiAnalysisCard
                investigationId={investigation.id}
                hasScreeningResults={screeningResults.length > 0}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="screening" className="mt-6">
          <ScreeningResults
            investigationId={investigation.id}
            initialResults={screeningResults}
            userRole={userRole}
          />
        </TabsContent>

        <TabsContent value="edd" className="mt-6">
          <EddTab
            investigationId={investigation.id}
            canEdit={canEditEdd}
            onJumpToDocuments={() => setActiveTab('documents')}
          />
        </TabsContent>

        <TabsContent value="application" className="mt-6">
          <ApplicationTab investigationId={investigation.id} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <DocumentsTab investigationId={investigation.id} />
        </TabsContent>

        <TabsContent value="ownership" className="mt-6">
          <OwnershipGraph investigationId={investigation.id} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          {timelineEvents.length > 0 ? (
            <div className="space-y-4">
              {timelineEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex gap-4 rounded-lg border border-border p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{event.title}</p>
                    {event.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      <ClientDate date={event.created_at} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="No timeline events"
              description="Timeline events will appear here as the investigation progresses."
            />
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <NotesTab investigationId={investigation.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
