'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Building2,
  Clock,
  FileText,
  GitBranch,
  MessageSquare,
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
import { RiskScoreRing } from '@/components/investigation/risk-score-ring'
import { ScreeningResults } from '@/components/investigation/screening-results'
import { AiAnalysisCard } from '@/components/investigation/ai-analysis-card'
import { formatDateTime } from '@/lib/utils/formatting'

type Investigation = {
  id: string
  status: string
  risk_score: number | null
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
  }
  screening_results: Array<{
    id: string
    type: string
    status: string
    hit_count: number
  }>
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

export default function InvestigationWorkspacePage() {
  const params = useParams<{ id: string }>()
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchInvestigation = useCallback(async () => {
    const res = await fetch(`/api/investigations/${params.id}`)
    if (res.ok) {
      const json = await res.json()
      setInvestigation(json.data)
    }
    setIsLoading(false)
  }, [params.id])

  useEffect(() => {
    fetchInvestigation()
  }, [fetchInvestigation])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  if (!investigation) {
    return (
      <EmptyState
        title="Investigation not found"
        description="The investigation you're looking for doesn't exist or you don't have access."
      />
    )
  }

  const entity = investigation.entity

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
            {formatDateTime(investigation.created_at)}
          </p>
        </div>
        {investigation.risk_score != null && (
          <RiskScoreRing score={investigation.risk_score} size="lg" />
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <Building2 className="mr-1.5 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="screening">
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Screening
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
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Risk Score</span>
                  <span>{investigation.risk_score ?? 'Not scored'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDateTime(investigation.created_at)}</span>
                </div>
              </CardContent>
            </Card>

            <AiAnalysisCard
              investigationId={investigation.id}
              hasScreeningResults={investigation.screening_results.length > 0}
            />
          </div>
        </TabsContent>

        <TabsContent value="screening" className="mt-6">
          <ScreeningResults investigationId={investigation.id} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <EmptyState
            icon={FileText}
            title="No documents uploaded"
            description="Upload supporting documents like certificates of incorporation, ID documents, and financial statements."
          />
        </TabsContent>

        <TabsContent value="ownership" className="mt-6">
          <EmptyState
            icon={GitBranch}
            title="No ownership structure"
            description="Map out the ownership and control structure of this entity."
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          {investigation.timeline_events.length > 0 ? (
            <div className="space-y-4">
              {investigation.timeline_events.map((event) => (
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
                      {formatDateTime(event.created_at)}
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
          <EmptyState
            icon={MessageSquare}
            title="No analyst notes"
            description="Add notes to document your findings and analysis."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
