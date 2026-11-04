import { createAdminClient } from '@/lib/supabase/admin'
import type { GraphData, GraphNode, GraphEdge } from './types'
import { LINK_TYPE_TO_RELATIONSHIP } from './types'

const MAX_DEPTH = 3

interface BuildResult {
  graphData: GraphData
  maxDepth: number
  totalNodes: number
  totalEdges: number
}

export async function buildGraphData(
  investigationId: string,
  orgId: string
): Promise<BuildResult> {
  const supabase = createAdminClient()

  const { data: investigation } = await supabase
    .from('investigations')
    .select('id, entity_id, risk_score')
    .eq('id', investigationId)
    .eq('org_id', orgId)
    .single()

  if (!investigation) {
    return { graphData: { nodes: [], edges: [] }, maxDepth: 0, totalNodes: 0, totalEdges: 0 }
  }

  const { data: subjectEntity } = await supabase
    .from('entities')
    .select('*')
    .eq('id', investigation.entity_id)
    .single()

  if (!subjectEntity) {
    return { graphData: { nodes: [], edges: [] }, maxDepth: 0, totalNodes: 0, totalEdges: 0 }
  }

  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const visited = new Set<string>()

  nodes.set(subjectEntity.id, {
    id: subjectEntity.id,
    label: subjectEntity.name,
    entityType: subjectEntity.type,
    riskScore: investigation.risk_score,
    country: subjectEntity.jurisdiction,
    registrationNumber: subjectEntity.registration_number,
    isSubject: true,
    metadata: (subjectEntity.metadata ?? {}) as Record<string, unknown>,
  })

  let maxDepth = 0

  async function resolveLinks(entityId: string, depth: number) {
    if (depth > MAX_DEPTH || visited.has(entityId)) return
    visited.add(entityId)
    if (depth > maxDepth) maxDepth = depth

    const { data: linksAsParent } = await supabase
      .from('ownership_links')
      .select('*')
      .eq('parent_entity_id', entityId)
      .eq('org_id', orgId)

    const { data: linksAsChild } = await supabase
      .from('ownership_links')
      .select('*')
      .eq('child_entity_id', entityId)
      .eq('org_id', orgId)

    const allLinks = [...(linksAsParent ?? []), ...(linksAsChild ?? [])]

    for (const link of allLinks) {
      const edgeId = link.id
      if (edges.some((e) => e.id === edgeId)) continue

      const relatedEntityId =
        link.parent_entity_id === entityId
          ? link.child_entity_id
          : link.parent_entity_id

      if (!nodes.has(relatedEntityId)) {
        const { data: entity } = await supabase
          .from('entities')
          .select('*')
          .eq('id', relatedEntityId)
          .single()

        if (entity) {
          const { data: relatedInv } = await supabase
            .from('investigations')
            .select('risk_score')
            .eq('entity_id', entity.id)
            .eq('org_id', orgId)
            .limit(1)
            .single()

          nodes.set(entity.id, {
            id: entity.id,
            label: entity.name,
            entityType: entity.type,
            riskScore: relatedInv?.risk_score ?? null,
            country: entity.jurisdiction,
            registrationNumber: entity.registration_number,
            isSubject: false,
            metadata: (entity.metadata ?? {}) as Record<string, unknown>,
          })
        }
      }

      edges.push({
        id: edgeId,
        source: link.parent_entity_id,
        target: link.child_entity_id,
        relationshipType:
          LINK_TYPE_TO_RELATIONSHIP[link.link_type] ?? 'SHAREHOLDER',
        ownershipPercentage: link.ownership_pct ?? undefined,
        isDirectLink: depth === 0,
      })

      await resolveLinks(relatedEntityId, depth + 1)
    }
  }

  await resolveLinks(subjectEntity.id, 0)

  return {
    graphData: {
      nodes: Array.from(nodes.values()),
      edges,
    },
    maxDepth,
    totalNodes: nodes.size,
    totalEdges: edges.length,
  }
}
