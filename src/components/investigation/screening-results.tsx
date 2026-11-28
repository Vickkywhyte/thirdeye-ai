'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Loader2,
  Play,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Building2,
  XCircle,
} from 'lucide-react'
import { SourceEvidenceCard } from './source-evidence-card'
import {
  DispositionBadge,
  ReviewHitDialog,
} from '@/components/investigation/review-hit-dialog'
import type { HitDisposition } from '@/lib/validation/schemas'

interface ScreeningHit {
  id: string
  source: string
  match_score: number
  matched_name: string | null
  data: Record<string, unknown>
  is_confirmed: boolean
  disposition: HitDisposition
  review_rationale: string | null
}

export interface ScreeningResult {
  id: string
  type: string
  status: string
  hit_count: number
  error_message?: string | null
  started_at?: string | null
  completed_at?: string | null
  screening_hits?: ScreeningHit[]
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  sanctions: {
    label: 'Sanctions',
    icon: <ShieldAlert className="h-4 w-4" />,
    color: 'text-red-400',
  },
  pep: {
    label: 'PEP',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-orange-400',
  },
  adverse_media: {
    label: 'Adverse Media',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-yellow-400',
  },
  registry: {
    label: 'Registry',
    icon: <Building2 className="h-4 w-4" />,
    color: 'text-blue-400',
  },
}

const DISSOLVED_STATUSES = ['dissolved', 'liquidation', 'administration', 'receivership']

function getCompanyStatus(hit: ScreeningHit): string | null {
  return typeof hit.data.status === 'string' ? hit.data.status.toLowerCase() : null
}

function classifyHitSeverity(score: number): string {
  if (score >= 85) return 'confirmed'
  if (score >= 60) return 'possible'
  return 'weak'
}

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="outline" className="border-green-500/30 bg-green-500/20 text-green-400">
          Completed
        </Badge>
      )
    case 'running':
      return (
        <Badge variant="outline" className="border-blue-500/30 bg-blue-500/20 text-blue-400">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Running
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="outline" className="border-red-500/30 bg-red-500/20 text-red-400">
          Failed
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="border-zinc-500/30 bg-zinc-500/20 text-zinc-400">
          Pending
        </Badge>
      )
  }
}

/** Returns the registry-specific summary badge for the accordion trigger. */
function registryTriggerBadge(result: ScreeningResult): React.ReactNode {
  const hits = result.screening_hits ?? []
  if (result.status !== 'completed') return null

  if (hits.length === 0) {
    return (
      <Badge variant="outline" className="border-zinc-600/30 bg-zinc-600/10 text-zinc-400">
        Not found
      </Badge>
    )
  }

  const companyStatus = getCompanyStatus(hits[0])
  if (companyStatus === 'active') {
    return (
      <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Verified
      </Badge>
    )
  }
  if (companyStatus && DISSOLVED_STATUSES.includes(companyStatus)) {
    return (
      <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400">
        <XCircle className="mr-1 h-3 w-3" />
        Warning
      </Badge>
    )
  }
  // Known but not active/dissolved — show the status directly
  return (
    <Badge variant="outline" className="border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
      {companyStatus ?? 'Found'}
    </Badge>
  )
}

/** Compact display for a registry hit — avoids the alarming "confirmed" severity badge. */
function RegistryHitCard({ hit }: { hit: ScreeningHit }) {
  const data = hit.data
  const companyStatus = getCompanyStatus(hit)
  const isActive = companyStatus === 'active'
  const isDissolved = companyStatus ? DISSOLVED_STATUSES.includes(companyStatus) : false

  const statusColor = isActive
    ? 'text-green-400'
    : isDissolved
      ? 'text-red-400'
      : 'text-yellow-400'

  const rows: Array<[string, string]> = [
    ['Company Name', hit.matched_name ?? '—'],
    ['Company Number', typeof data.companyNumber === 'string' ? data.companyNumber : '—'],
    ['Status', typeof data.status === 'string' ? data.status : '—'],
    ['Type', typeof data.type === 'string' ? data.type : '—'],
  ]

  if (typeof data.dateOfCreation === 'string') {
    rows.push(['Incorporated', data.dateOfCreation])
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">UK Companies House</span>
        <span className={`text-xs font-medium capitalize ${statusColor}`}>
          {typeof data.status === 'string' ? data.status : '—'}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="truncate text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {typeof hit.data.companyNumber === 'string' && (
        <a
          href={`https://find-and-update.company-information.service.gov.uk/company/${hit.data.companyNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
        >
          View on Companies House →
        </a>
      )}
    </div>
  )
}

const POLL_INTERVAL_MS = 3000
// Safety valve: stop polling after ~2 minutes so a provider that dies without
// writing a terminal status can't leave the page refreshing forever.
const MAX_POLLS = 40

export function ScreeningResults({
  investigationId,
  initialResults,
}: {
  investigationId: string
  initialResults: ScreeningResult[]
}) {
  const router = useRouter()
  const [triggering, setTriggering] = useState(false)
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const pollCount = useRef(0)

  const results = initialResults ?? []

  const isScreeningInFlight = results.some(
    (r) => r.status === 'pending' || r.status === 'running'
  )

  useEffect(() => {
    if (!isScreeningInFlight) {
      pollCount.current = 0
      return
    }

    const interval = setInterval(() => {
      if (pollCount.current >= MAX_POLLS) {
        clearInterval(interval)
        return
      }
      pollCount.current += 1
      router.refresh()
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [isScreeningInFlight, router])

  async function runScreening() {
    setTriggering(true)
    setTriggerError(null)
    try {
      const res = await fetch('/api/screening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investigation_id: investigationId,
          types: ['sanctions', 'pep', 'adverse_media', 'registry'],
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Request failed' }))
        setTriggerError(json.error ?? `Error ${res.status}`)
        return
      }
      pollCount.current = 0
      router.refresh()
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : 'Failed to start screening')
    } finally {
      setTriggering(false)
    }
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ShieldCheck className="h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-400">
          No screening has been run yet.
        </p>
        {triggerError && (
          <p className="mt-2 text-sm text-red-400">{triggerError}</p>
        )}
        <Button
          onClick={runScreening}
          disabled={triggering}
          className="mt-4"
          size="lg"
        >
          {triggering ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting screening…
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Screening
            </>
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          onClick={runScreening}
          disabled={triggering}
          variant="outline"
          size="sm"
        >
          {triggering ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Re-running…
            </>
          ) : (
            <>
              <Play className="mr-2 h-3.5 w-3.5" />
              Re-run Screening
            </>
          )}
        </Button>
      </div>
      {triggerError && (
        <p className="text-sm text-red-400">{triggerError}</p>
      )}

      <Accordion type="multiple" className="space-y-2">
        {results.map((result) => {
          const config = TYPE_CONFIG[result.type] ?? {
            label: result.type,
            icon: <ShieldAlert className="h-4 w-4" />,
            color: 'text-zinc-400',
          }
          const hits = result.screening_hits ?? []
          const isRegistry = result.type === 'registry'

          return (
            <AccordionItem
              key={result.id}
              value={result.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-center justify-between pr-2">
                  <div className="flex items-center gap-2">
                    <span className={config.color}>{config.icon}</span>
                    <span className="text-sm font-medium text-zinc-200">
                      {config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isRegistry ? (
                      registryTriggerBadge(result)
                    ) : result.status === 'completed' && result.hit_count === 0 ? (
                      <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        0 hits found
                      </Badge>
                    ) : result.hit_count > 0 ? (
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                        {result.hit_count} hit{result.hit_count !== 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                    {statusBadge(result.status)}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {result.error_message && (
                  <p className="mb-3 text-xs text-red-400">
                    Error: {result.error_message}
                  </p>
                )}
                {isRegistry ? (
                  hits.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      {result.status === 'completed'
                        ? 'Company not found in UK Companies House registry'
                        : 'Awaiting results…'}
                    </p>
                  ) : (
                    <div className="space-y-2 pb-2">
                      {hits.map((hit) => (
                        <RegistryHitCard key={hit.id} hit={hit} />
                      ))}
                    </div>
                  )
                ) : hits.length === 0 ? (
                  <p className="py-4 text-center text-sm text-zinc-500">
                    {result.status === 'completed'
                      ? 'No matches found'
                      : 'Awaiting results…'}
                  </p>
                ) : (
                  <div className="space-y-3 pb-2">
                    {hits.map((hit) => (
                      <div key={hit.id} className="space-y-2">
                        <SourceEvidenceCard
                          source={hit.source}
                          matchScore={hit.match_score}
                          matchedName={hit.matched_name}
                          severity={classifyHitSeverity(hit.match_score)}
                          data={hit.data as Record<string, unknown>}
                          sourceUrl={
                            (hit.data as Record<string, unknown>)
                              .sourceUrl as string | undefined
                          }
                        />
                        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
                          <div className="flex min-w-0 flex-col gap-1">
                            <DispositionBadge disposition={hit.disposition} />
                            {hit.review_rationale && (
                              <p className="truncate text-xs text-muted-foreground">
                                {hit.review_rationale}
                              </p>
                            )}
                          </div>
                          <ReviewHitDialog
                            hitId={hit.id}
                            currentDisposition={hit.disposition}
                            source={hit.source}
                            matchedName={hit.matched_name}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
