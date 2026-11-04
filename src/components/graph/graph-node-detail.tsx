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
  onClose: () => void
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  OWNS: 'Owns',
  CONTROLS: 'Controls',
  DIRECTOR: 'Director of',
  SHAREHOLDER: 'Shareholder of',
  BENEFICIAL_OWNER: 'Beneficial Owner of',
}

export function GraphNodeDetail({
  node,
  edges,
  investigationId,
  onClose,
}: GraphNodeDetailProps) {
  const connectedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  )

  return (
    <div className="absolute right-4 top-16 z-20 w-72 rounded-lg border border-zinc-700 bg-zinc-900/95 p-4 shadow-xl backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-zinc-200">
            {node.label}
          </h3>
          <Badge
            variant="outline"
            className="mt-1 border-zinc-700 text-[10px] capitalize text-zinc-400"
          >
            {node.entityType}
          </Badge>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {node.country && (
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Country</span>
            <span className="text-zinc-300">{node.country}</span>
          </div>
        )}
        {node.registrationNumber && (
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Reg. No.</span>
            <span className="text-zinc-300">{node.registrationNumber}</span>
          </div>
        )}
        {node.riskScore !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Risk Score</span>
            <RiskScoreRing score={node.riskScore} size="sm" />
          </div>
        )}
      </div>

      {connectedEdges.length > 0 && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Relationships
          </p>
          <div className="space-y-1">
            {connectedEdges.map((edge) => (
              <div key={edge.id} className="text-xs text-zinc-400">
                {RELATIONSHIP_LABELS[edge.relationshipType] ?? edge.relationshipType}
                {edge.ownershipPercentage != null && (
                  <span className="ml-1 text-zinc-500">
                    ({edge.ownershipPercentage}%)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {!node.isSubject && (
          <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
            <Link href={`/investigations?entity=${node.id}`}>
              Open Investigation
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
    </div>
  )
}
