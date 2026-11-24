import { NextRequest, connection } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  apiSuccess,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'

// Only these event types are shown as actionable alerts
const ACTIONABLE_TYPES = [
  'risk_override',
  'screening_completed',
  'child_investigation_opened',
  'status_changed',
  'escalated',
]

/** Extract hit count from the description written by the screening orchestrator.
 *  Description format: "Risk score: 75/100. 3 total hits across 4 checks."
 *  Returns null if the description doesn't match (treat as non-zero to be safe). */
function parseHitCount(description: string | null): number | null {
  if (!description) return null
  const m = description.match(/(\d+) total hits/)
  return m ? parseInt(m[1], 10) : null
}

/** Extract risk score from the description.
 *  Returns null if not parseable. */
function parseRiskScore(description: string | null): number | null {
  if (!description) return null
  const m = description.match(/Risk score:\s*(\d+)\/100/)
  return m ? parseInt(m[1], 10) : null
}

function isHighRiskScreening(description: string | null): boolean {
  const hits = parseHitCount(description)
  if (hits === null) return true   // unknown — show it to be safe
  if (hits === 0) return false
  const score = parseRiskScore(description)
  if (score === null) return true  // hits > 0 but no score — show it
  return score >= 40               // medium (40), high (60), critical (80)
}

export async function GET(request: NextRequest) {
  await connection()
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:read')) return apiForbidden()

    const { searchParams } = new URL(request.url)
    // Fetch more than needed so deduplication doesn't shrink the result set too far
    const requestedLimit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const fetchLimit = requestedLimit * 4

    const supabase = await createClient()

    const { data: events } = await supabase
      .from('timeline_events')
      .select(
        'id, event_type, title, description, created_at, investigation_id, data, investigations!inner(org_id, entity:entities!inner(name))'
      )
      .eq('investigations.org_id', user.orgId)
      .in('event_type', ACTIONABLE_TYPES)
      .order('created_at', { ascending: false })
      .limit(fetchLimit)

    // 1. Filter out clean screening_completed events (0 hits or low risk score)
    const filtered = (events ?? []).filter((e) => {
      if (e.event_type !== 'screening_completed') return true
      return isHighRiskScreening(e.description)
    })

    // 2. Deduplicate: keep only the most recent event per investigation + event_type
    const seen = new Set<string>()
    const deduped = filtered.filter((e) => {
      const key = `${e.investigation_id}:${e.event_type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const alerts = deduped.slice(0, requestedLimit).map((e) => {
      const inv = e.investigations as unknown as {
        org_id: string
        entity: { name: string }
      } | null

      return {
        id: e.id,
        event_type: e.event_type,
        title: e.title,
        description: e.description,
        created_at: e.created_at,
        investigation_id: e.investigation_id,
        entity_name: inv?.entity?.name ?? null,
      }
    })

    return apiSuccess({ alerts, total: alerts.length })
  } catch (error) {
    return handleApiError(error)
  }
}
