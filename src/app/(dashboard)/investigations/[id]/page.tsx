import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { EmptyState } from '@/components/shared/empty-state'
import type { Tables } from '@/types/database'
import {
  InvestigationWorkspace,
  type InvestigationWorkspaceData,
} from '@/components/investigation/investigation-workspace'

export const instant = false

type PageParams = { params: Promise<{ id: string }> }

export default async function InvestigationWorkspacePage({
  params,
}: PageParams) {
  await connection()
  const { id } = await params

  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = createAdminClient()

  // Admin client bypasses RLS, so we scope ownership explicitly by org.
  const { data: investigation } = await supabase
    .from('investigations')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (!investigation) {
    return (
      <EmptyState
        title="Investigation not found"
        description="The investigation you're looking for doesn't exist or you don't have access."
      />
    )
  }

  // Fetch parent investigation + entity name for the linked-investigation badge.
  let parentEntity: { id: string; name: string } | null = null
  if (investigation.parent_investigation_id) {
    const { data: parentInv } = await supabase
      .from('investigations')
      .select('id, entity_id')
      .eq('id', investigation.parent_investigation_id)
      .single()
    if (parentInv) {
      const { data: pe } = await supabase
        .from('entities')
        .select('id, name')
        .eq('id', parentInv.entity_id)
        .single()
      if (pe) parentEntity = pe
    }
  }

  // Fetch override user name if the investigation has been overridden
  let overrideByName: string | null = null
  if (investigation.override_by) {
    const { data: overrideUser } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', investigation.override_by)
      .single()
    overrideByName = overrideUser?.full_name ?? null
  }

  const { data: complianceManagersData } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('org_id', user.orgId)
    .eq('role', 'compliance_manager')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const complianceManagers = complianceManagersData ?? []

  const [entityRes, screeningRes, timelineRes] = await Promise.all([
    supabase
      .from('entities')
      .select('*')
      .eq('id', investigation.entity_id)
      .single(),
    supabase
      .from('screening_results')
      .select('*')
      .eq('investigation_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('timeline_events')
      .select('*')
      .eq('investigation_id', id)
      .order('created_at', { ascending: false }),
  ])

  const screeningResults = screeningRes.data ?? []

  // Attach hits to each result in a single query (grouped by result_id).
  const resultIds = screeningResults.map((r) => r.id)
  let hits: Tables<'screening_hits'>[] = []
  if (resultIds.length > 0) {
    const { data } = await supabase
      .from('screening_hits')
      .select('*')
      .in('result_id', resultIds)
    hits = data ?? []
  }

  const hitsByResult = new Map<string, Tables<'screening_hits'>[]>()
  for (const hit of hits) {
    const existing = hitsByResult.get(hit.result_id) ?? []
    existing.push(hit)
    hitsByResult.set(hit.result_id, existing)
  }

  const data: InvestigationWorkspaceData = {
    id: investigation.id,
    parent_investigation_id: investigation.parent_investigation_id ?? null,
    parent_entity_name: parentEntity?.name ?? null,
    status: investigation.status,
    risk_score: investigation.risk_score,
    override_risk_score: investigation.override_risk_score ?? null,
    override_reason: investigation.override_reason ?? null,
    override_by: investigation.override_by ?? null,
    override_by_name: overrideByName,
    override_at: investigation.override_at ?? null,
    assigned_to: investigation.assigned_to,
    summary: investigation.summary,
    created_at: investigation.created_at,
    updated_at: investigation.updated_at,
    entity: entityRes.data
      ? {
          id: entityRes.data.id,
          name: entityRes.data.name,
          type: entityRes.data.type,
          jurisdiction: entityRes.data.jurisdiction,
          registration_number: entityRes.data.registration_number,
          counterparty_type: entityRes.data.counterparty_type ?? null,
        }
      : {
          id: '',
          name: 'Unknown entity',
          type: 'unknown',
          jurisdiction: null,
          registration_number: null,
          counterparty_type: null,
        },
    screening_results: screeningResults.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      hit_count: r.hit_count,
      error_message: r.error_message,
      started_at: r.started_at,
      completed_at: r.completed_at,
      screening_hits: (hitsByResult.get(r.id) ?? []).map((h) => ({
        id: h.id,
        source: h.source,
        match_score: h.match_score,
        matched_name: h.matched_name,
        data: (h.data ?? {}) as Record<string, unknown>,
        is_confirmed: h.is_confirmed ?? false,
      })),
    })),
    timeline_events: timelineRes.data ?? [],
  }

  return (
    <InvestigationWorkspace
      investigation={data}
      userRole={user.role}
      complianceManagers={complianceManagers}
    />
  )
}
