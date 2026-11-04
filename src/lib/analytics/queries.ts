import { createAdminClient } from '@/lib/supabase/admin'

export interface DashboardMetrics {
  totalInvestigations: number
  activeInvestigations: number
  completedThisMonth: number
  avgRiskScore: number
  highRiskCount: number
  pendingReviews: number
}

export interface RiskBand {
  label: string
  count: number
  percentage: number
  color: string
}

export interface TrendPoint {
  date: string
  count: number
  completed: number
}

export interface ScreeningBreakdown {
  sanctions: number
  pep: number
  adverseMedia: number
  registry: number
}

export interface TopRiskEntity {
  id: string
  name: string
  entityType: string
  riskScore: number
  investigationId: string
  lastScreened: string | null
}

export interface RecentActivityItem {
  id: string
  eventType: string
  title: string
  description: string | null
  entityName: string
  investigationId: string
  createdAt: string
}

export async function getDashboardMetrics(
  orgId: string
): Promise<DashboardMetrics> {
  const supabase = createAdminClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: investigations } = await supabase
    .from('investigations')
    .select('id, status, risk_score')
    .eq('org_id', orgId)

  const all = investigations ?? []
  const totalInvestigations = all.length
  const activeInvestigations = all.filter((i) => i.status === 'active').length
  const pendingReviews = all.filter((i) => i.status === 'pending_review').length
  const highRiskCount = all.filter(
    (i) => i.risk_score !== null && i.risk_score >= 60
  ).length

  const scored = all.filter((i) => i.risk_score !== null)
  const avgRiskScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, i) => sum + (i.risk_score ?? 0), 0) / scored.length
        )
      : 0

  const { count: completedThisMonth } = await supabase
    .from('investigations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'completed' as 'active' | 'pending_review' | 'completed' | 'escalated' | 'archived')
    .gte('updated_at', monthStart)

  return {
    totalInvestigations,
    activeInvestigations,
    completedThisMonth: completedThisMonth ?? 0,
    avgRiskScore,
    highRiskCount,
    pendingReviews,
  }
}

export async function getRiskDistribution(orgId: string): Promise<RiskBand[]> {
  const supabase = createAdminClient()

  const { data: investigations } = await supabase
    .from('investigations')
    .select('risk_score')
    .eq('org_id', orgId)
    .not('risk_score', 'is', null)

  const all = investigations ?? []
  const total = all.length

  if (total === 0) return []

  const bands = [
    { label: 'Critical', min: 80, max: 100, color: '#EF4444' },
    { label: 'High', min: 60, max: 79, color: '#F97316' },
    { label: 'Medium', min: 40, max: 59, color: '#EAB308' },
    { label: 'Low', min: 0, max: 39, color: '#22C55E' },
  ]

  return bands.map((band) => {
    const count = all.filter(
      (i) =>
        (i.risk_score ?? 0) >= band.min && (i.risk_score ?? 0) <= band.max
    ).length
    return {
      label: band.label,
      count,
      percentage: Math.round((count / total) * 100),
      color: band.color,
    }
  })
}

export async function getInvestigationTrend(
  orgId: string,
  days: 30 | 90 = 30
): Promise<TrendPoint[]> {
  const supabase = createAdminClient()
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: investigations } = await supabase
    .from('investigations')
    .select('created_at, status')
    .eq('org_id', orgId)
    .gte('created_at', since.toISOString())

  const all = investigations ?? []
  const points: TrendPoint[] = []

  for (let d = 0; d < days; d++) {
    const date = new Date()
    date.setDate(date.getDate() - (days - 1 - d))
    const dateStr = date.toISOString().split('T')[0]

    const dayItems = all.filter(
      (i) => i.created_at.split('T')[0] === dateStr
    )

    points.push({
      date: dateStr,
      count: dayItems.length,
      completed: dayItems.filter((i) => i.status === 'completed').length,
    })
  }

  return points
}

export async function getScreeningBreakdown(
  orgId: string
): Promise<ScreeningBreakdown> {
  const supabase = createAdminClient()

  const { data: investigations } = await supabase
    .from('investigations')
    .select('id')
    .eq('org_id', orgId)

  const invIds = (investigations ?? []).map((i) => i.id)
  if (invIds.length === 0) {
    return { sanctions: 0, pep: 0, adverseMedia: 0, registry: 0 }
  }

  const { data: results } = await supabase
    .from('screening_results')
    .select('type, hit_count')
    .in('investigation_id', invIds)
    .eq('status', 'completed' as 'pending' | 'running' | 'completed' | 'failed')

  const all = results ?? []

  return {
    sanctions: all
      .filter((r) => r.type === 'sanctions')
      .reduce((sum, r) => sum + r.hit_count, 0),
    pep: all
      .filter((r) => r.type === 'pep')
      .reduce((sum, r) => sum + r.hit_count, 0),
    adverseMedia: all
      .filter((r) => r.type === 'adverse_media')
      .reduce((sum, r) => sum + r.hit_count, 0),
    registry: all
      .filter((r) => r.type === 'registry')
      .reduce((sum, r) => sum + r.hit_count, 0),
  }
}

export async function getTopRiskEntities(
  orgId: string,
  limit = 5
): Promise<TopRiskEntity[]> {
  const supabase = createAdminClient()

  const { data: investigations } = await supabase
    .from('investigations')
    .select('id, entity_id, risk_score, updated_at')
    .eq('org_id', orgId)
    .not('risk_score', 'is', null)
    .order('risk_score', { ascending: false })
    .limit(limit)

  if (!investigations || investigations.length === 0) return []

  const entityIds = investigations.map((i) => i.entity_id)
  const { data: entities } = await supabase
    .from('entities')
    .select('id, name, type')
    .in('id', entityIds)

  const entityMap = new Map(
    (entities ?? []).map((e) => [e.id, e])
  )

  return investigations.map((inv) => {
    const entity = entityMap.get(inv.entity_id)
    return {
      id: entity?.id ?? inv.entity_id,
      name: entity?.name ?? 'Unknown',
      entityType: entity?.type ?? 'unknown',
      riskScore: inv.risk_score ?? 0,
      investigationId: inv.id,
      lastScreened: inv.updated_at,
    }
  })
}

export async function getRecentActivity(
  orgId: string,
  limit = 10
): Promise<RecentActivityItem[]> {
  const supabase = createAdminClient()

  const { data: investigations } = await supabase
    .from('investigations')
    .select('id, entity_id')
    .eq('org_id', orgId)

  const invIds = (investigations ?? []).map((i) => i.id)
  if (invIds.length === 0) return []

  const entityIds = [...new Set((investigations ?? []).map((i) => i.entity_id))]
  const { data: entities } = await supabase
    .from('entities')
    .select('id, name')
    .in('id', entityIds)

  const entityMap = new Map(
    (entities ?? []).map((e) => [e.id, e.name])
  )
  const invEntityMap = new Map(
    (investigations ?? []).map((i) => [i.id, i.entity_id])
  )

  const { data: events } = await supabase
    .from('timeline_events')
    .select('*')
    .in('investigation_id', invIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (events ?? []).map((e) => {
    const entityId = invEntityMap.get(e.investigation_id)
    return {
      id: e.id,
      eventType: e.event_type,
      title: e.title,
      description: e.description,
      entityName: entityMap.get(entityId ?? '') ?? 'Unknown',
      investigationId: e.investigation_id,
      createdAt: e.created_at,
    }
  })
}
