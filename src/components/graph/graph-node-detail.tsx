'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RiskScoreRing } from '@/components/investigation/risk-score-ring'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'

interface GraphNodeDetailProps {
  node: GraphNode
  edges: GraphEdge[]
  investigationId: string
  /** Current investigation's id — passed as parentId when opening a child investigation. */
  parentInvestigationId?: string
  onClose: () => void
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  OWNS: 'Owns',
  CONTROLS: 'Controls',
  DIRECTOR: 'Director of',
  SHAREHOLDER: 'Shareholder of',
  BENEFICIAL_OWNER: 'Beneficial Owner of',
}

/**
 * Start a new investigation pre-filled from a graph node. Directors and PSCs
 * are natural persons, so they open the individual (KYC) flow, which skips the
 * company-registry check.
 */
function buildScreeningHref(node: GraphNode, parentInvestigationId?: string): string {
  const params = new URLSearchParams({
    type: node.entityType === 'individual' ? 'individual' : 'corporate',
    name: node.label,
  })
  if (node.country) params.set('jurisdiction', node.country)
  if (node.entityType !== 'individual' && node.registrationNumber) {
    params.set('registration_number', node.registrationNumber)
  }
  if (parentInvestigationId) params.set('parentId', parentInvestigationId)
  return `/investigations/new?${params.toString()}`
}

export function GraphNodeDetail({
  node,
  edges,
  investigationId,
  parentInvestigationId,
  onClose,
}: GraphNodeDetailProps) {
  const connectedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  )

  return (
    <div className="absolute right-4 top-16 z-20 w-72 rounded-lg border border-border bg-card/95 p-4 shadow-xl backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-card-foreground">
            {node.label}
          </h3>
          <Badge
            variant="outline"
            className="mt-1 text-[10px] capitalize text-muted-foreground"
          >
            {node.entityType}
          </Badge>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {node.country && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Country</span>
            <span className="text-foreground">{node.country}</span>
          </div>
        )}
        {node.registrationNumber && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Reg. No.</span>
            <span className="text-foreground">{node.registrationNumber}</span>
          </div>
        )}
        {node.riskScore !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Risk Score</span>
            <RiskScoreRing score={node.riskScore} size="sm" />
          </div>
        )}
      </div>

      {connectedEdges.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Relationships
          </p>
          <div className="space-y-1">
            {connectedEdges.map((edge) => (
              <div key={edge.id} className="text-xs text-muted-foreground">
                {RELATIONSHIP_LABELS[edge.relationshipType] ?? edge.relationshipType}
                {edge.ownershipPercentage != null && (
                  <span className="ml-1 opacity-70">
                    ({edge.ownershipPercentage}%)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex gap-2">
          {!node.isSubject && (
            <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
              <Link href={buildScreeningHref(node, parentInvestigationId ?? investigationId)}>
                {node.entityType === 'individual'
                  ? 'Screen Individual'
                  : 'Open Investigation'}
              </Link>
            </Button>
          )}
          {node.isSubject && (
            <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
              <Link href={`/investigations/${investigationId}`}>
                View Details
              </Link>
            </Button>
          )}
        </div>
        {!node.isSubject && node.isLinkedElsewhere && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs border-purple-500/40 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
            asChild
          >
            <Link href={`/investigations?search=${encodeURIComponent(node.label)}`}>
              View {node.linkedInvestigationCount} other investigation{node.linkedInvestigationCount !== 1 ? 's' : ''}
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
