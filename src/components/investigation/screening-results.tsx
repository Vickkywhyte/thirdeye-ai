'use client'

import { useEffect, useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldAlert, ShieldCheck, AlertTriangle, Building2 } from 'lucide-react'
import { SourceEvidenceCard } from './source-evidence-card'

interface ScreeningHit {
  id: string
  source: string
  match_score: number
  matched_name: string | null
  data: Record<string, unknown>
  is_confirmed: boolean
}

interface ScreeningResult {
  id: string
  type: string
  status: string
  hit_count: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  screening_hits: ScreeningHit[]
}

interface ScreeningStatusResponse {
  investigation_id: string
  status: string
  results: ScreeningResult[]
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

export function ScreeningResults({
  investigationId,
}: {
  investigationId: string
}) {
  const [data, setData] = useState<ScreeningStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let interval: ReturnType<typeof setInterval> | null = null

    async function fetchStatus() {
      try {
        const res = await fetch(
          `/api/screening/${investigationId}/status`
        )
        if (!res.ok) return
        const json = await res.json()
        if (active) {
          setData(json.data)
          setLoading(false)

          if (
            json.data.status === 'completed' ||
            json.data.results.length === 0
          ) {
            if (interval) clearInterval(interval)
          }
        }
      } catch {
        if (active) setLoading(false)
      }
    }

    fetchStatus()
    interval = setInterval(fetchStatus, 3000)

    return () => {
      active = false
      if (interval) clearInterval(interval)
    }
  }, [investigationId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        <span className="ml-2 text-zinc-500">Loading screening results…</span>
      </div>
    )
  }

  if (!data || data.results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ShieldCheck className="h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-400">
          No screening has been run yet.
        </p>
      </div>
    )
  }

  return (
    <Accordion type="multiple" className="space-y-2">
      {data.results.map((result) => {
        const config = TYPE_CONFIG[result.type] ?? {
          label: result.type,
          icon: <ShieldAlert className="h-4 w-4" />,
          color: 'text-zinc-400',
        }

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
                  {result.hit_count > 0 && (
                    <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                      {result.hit_count} hit{result.hit_count !== 1 ? 's' : ''}
                    </Badge>
                  )}
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
              {result.screening_hits.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-500">
                  {result.status === 'completed'
                    ? 'No matches found'
                    : 'Awaiting results…'}
                </p>
              ) : (
                <div className="space-y-2 pb-2">
                  {result.screening_hits.map((hit) => (
                    <SourceEvidenceCard
                      key={hit.id}
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
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
