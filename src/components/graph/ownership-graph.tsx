'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { RiskScoreRing } from '@/components/investigation/risk-score-ring'
import { GitBranch } from 'lucide-react'
import { useGraphData } from '@/hooks/use-graph-data'
import { GraphControls } from './graph-controls'
import { GraphLegend } from './graph-legend'
import { GraphNodeDetail } from './graph-node-detail'
import {
  RISK_COLORS,
  riskLevel,
  DEFAULT_GRAPH_CONFIG,
  type GraphConfig,
  type GraphNode,
  type GraphEdge,
} from '@/lib/graph/types'

interface OwnershipGraphProps {
  investigationId: string
}

interface SimNode extends d3.SimulationNodeDatum, GraphNode {}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string
  relationshipType: GraphEdge['relationshipType']
  ownershipPercentage?: number
  isDirectLink: boolean
}

function nodeRadius(node: GraphNode): number {
  if (node.isSubject) return 40
  if (node.riskScore === null) return 22
  return 20 + (node.riskScore / 100) * 25
}

function edgeStrokeWidth(pct?: number): number {
  if (pct === undefined) return 1.5
  return 1 + (pct / 100) * 3
}

function edgeDashArray(type: GraphEdge['relationshipType']): string | undefined {
  switch (type) {
    case 'CONTROLS':
      return '6 3'
    case 'DIRECTOR':
      return '2 3'
    case 'BENEFICIAL_OWNER':
      return '8 3 2 3'
    default:
      return undefined
  }
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    setMobile(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return mobile
}

// ── Mobile tree list fallback ────────────────────────────────

function MobileTreeFallback({
  nodes,
  edges,
  investigationId,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  investigationId: string
}) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  const grouped = new Map<string, Array<{ node: GraphNode; edge: GraphEdge }>>()
  for (const edge of edges) {
    const nodeId = edge.target
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) continue
    const key = edge.relationshipType
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push({ node, edge })
  }

  const LABELS: Record<string, string> = {
    OWNS: 'Ownership',
    CONTROLS: 'Control',
    DIRECTOR: 'Directors',
    SHAREHOLDER: 'Shareholders',
    BENEFICIAL_OWNER: 'Beneficial Owners',
  }

  const subject = nodes.find((n) => n.isSubject)

  return (
    <div className="space-y-4">
      {subject && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
          <div className="flex items-center gap-3">
            {subject.riskScore !== null && (
              <RiskScoreRing score={subject.riskScore} size="sm" />
            )}
            <div>
              <p className="text-sm font-semibold text-zinc-200">
                {subject.label}
              </p>
              <p className="text-xs capitalize text-zinc-500">
                {subject.entityType} &middot; Subject entity
              </p>
            </div>
          </div>
        </div>
      )}

      {Array.from(grouped.entries()).map(([type, items]) => (
        <div key={type}>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            {LABELS[type] ?? type}
          </h4>
          <div className="space-y-1.5">
            {items.map(({ node, edge }) => (
              <button
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-800 p-2.5 text-left transition-colors hover:bg-zinc-900"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: RISK_COLORS[riskLevel(node.riskScore)],
                    }}
                  />
                  <span className="truncate text-sm text-zinc-300">
                    {node.label}
                  </span>
                </div>
                {edge.ownershipPercentage != null && (
                  <Badge variant="outline" className="ml-2 shrink-0 border-zinc-700 text-[10px]">
                    {edge.ownershipPercentage}%
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {grouped.size === 0 && (
        <p className="py-8 text-center text-sm text-zinc-500">
          No ownership links recorded yet
        </p>
      )}

      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-t-xl bg-zinc-900 p-4">
            <GraphNodeDetail
              node={selectedNode}
              edges={edges}
              investigationId={investigationId}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Desktop D3 force graph ───────────────────────────────────

function DesktopForceGraph({
  nodes,
  edges,
  config,
  investigationId,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  config: GraphConfig
  investigationId: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [tooltip, setTooltip] = useState<{
    node: GraphNode
    edge?: GraphEdge
    x: number
    y: number
  } | null>(null)

  const filteredEdges = config.minOwnershipThreshold > 0
    ? edges.filter(
        (e) =>
          e.ownershipPercentage === undefined ||
          e.ownershipPercentage >= config.minOwnershipThreshold
      )
    : edges

  const connectedNodeIds = new Set<string>()
  for (const e of filteredEdges) {
    connectedNodeIds.add(e.source)
    connectedNodeIds.add(e.target)
  }
  const filteredNodes =
    config.minOwnershipThreshold > 0
      ? nodes.filter((n) => n.isSubject || connectedNodeIds.has(n.id))
      : nodes

  const renderGraph = useCallback(() => {
    const svg = svgRef.current
    if (!svg || filteredNodes.length === 0) return

    const width = svg.clientWidth
    const height = svg.clientHeight

    const d3svg = d3.select(svg)
    d3svg.selectAll('*').remove()

    const g = d3svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString())
      })

    d3svg.call(zoom)
    zoomRef.current = zoom

    const simNodes: SimNode[] = filteredNodes.map((n) => ({ ...n }))
    const simLinks: SimLink[] = filteredEdges.map((e) => ({
      ...e,
      source: e.source,
      target: e.target,
    }))

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 10))

    simulation.tick(300)
    simulation.stop()

    // Arrow markers
    const defs = g.append('defs')
    defs
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 0 10 6')
      .attr('refX', 10)
      .attr('refY', 3)
      .attr('markerWidth', 8)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L10,3 L0,6 Z')
      .attr('fill', '#6B7280')

    // Edges
    const linkGroup = g
      .append('g')
      .selectAll<SVGGElement, SimLink>('g')
      .data(simLinks)
      .join('g')

    linkGroup
      .append('line')
      .attr('x1', (d) => (d.source as SimNode).x ?? 0)
      .attr('y1', (d) => (d.source as SimNode).y ?? 0)
      .attr('x2', (d) => (d.target as SimNode).x ?? 0)
      .attr('y2', (d) => (d.target as SimNode).y ?? 0)
      .attr('stroke', '#4B5563')
      .attr('stroke-width', (d) => edgeStrokeWidth(d.ownershipPercentage))
      .attr('stroke-dasharray', (d) => edgeDashArray(d.relationshipType) ?? '')
      .attr('marker-end', 'url(#arrowhead)')

    if (config.showPercentages) {
      linkGroup
        .filter((d) => d.ownershipPercentage != null)
        .append('text')
        .attr(
          'x',
          (d) =>
            (((d.source as SimNode).x ?? 0) + ((d.target as SimNode).x ?? 0)) /
            2
        )
        .attr(
          'y',
          (d) =>
            (((d.source as SimNode).y ?? 0) + ((d.target as SimNode).y ?? 0)) /
              2 -
            6
        )
        .attr('text-anchor', 'middle')
        .attr('fill', '#9CA3AF')
        .attr('font-size', '10px')
        .text((d) => `${d.ownershipPercentage}%`)
    }

    // Nodes
    const nodeGroup = g
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
      .style('cursor', 'pointer')

    // Subject double-ring
    nodeGroup
      .filter((d) => d.isSubject)
      .append('circle')
      .attr('r', (d) => nodeRadius(d) + 4)
      .attr('fill', 'none')
      .attr('stroke', '#3B82F6')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 2')

    nodeGroup
      .append('circle')
      .attr('r', (d) => nodeRadius(d))
      .attr('fill', (d) =>
        config.highlightRisk
          ? RISK_COLORS[riskLevel(d.riskScore)]
          : '#4B5563'
      )
      .attr('fill-opacity', 0.2)
      .attr('stroke', (d) =>
        config.highlightRisk
          ? RISK_COLORS[riskLevel(d.riskScore)]
          : '#6B7280'
      )
      .attr('stroke-width', 2)

    if (config.showLabels) {
      nodeGroup
        .append('text')
        .attr('y', (d) => nodeRadius(d) + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', '#D1D5DB')
        .attr('font-size', '11px')
        .text((d) => {
          const flag = d.country ? getCountryFlag(d.country) : ''
          const name =
            d.label.length > 18 ? d.label.slice(0, 16) + '…' : d.label
          return flag ? `${flag} ${name}` : name
        })
    }

    // Interaction
    nodeGroup
      .on('click', (_event, d) => {
        setTooltip(null)
        setSelectedNode(d)
      })
      .on('mouseenter', (event, d) => {
        if (selectedNode) return
        const connEdge = filteredEdges.find(
          (e) => e.source === d.id || e.target === d.id
        )
        setTooltip({
          node: d,
          edge: connEdge,
          x: event.pageX,
          y: event.pageY,
        })
      })
      .on('mouseleave', () => {
        setTooltip(null)
      })
  }, [filteredNodes, filteredEdges, config, selectedNode])

  useEffect(() => {
    renderGraph()
  }, [renderGraph])

  function handleExportSvg() {
    const svg = svgRef.current
    if (!svg) return
    const serializer = new XMLSerializer()
    const source = serializer.serializeToString(svg)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ownership-graph.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFitToScreen() {
    const svg = svgRef.current
    if (!svg || !zoomRef.current) return
    d3.select(svg)
      .transition()
      .duration(500)
      .call(zoomRef.current.transform, d3.zoomIdentity)
  }

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <svg ref={svgRef} className="h-full w-full" />
      <GraphLegend />

      {tooltip && !selectedNode && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <p className="text-sm font-medium text-zinc-200">
            {tooltip.node.label}
          </p>
          <p className="text-xs capitalize text-zinc-500">
            {tooltip.node.entityType}
          </p>
          {tooltip.node.riskScore !== null && (
            <p className="text-xs text-zinc-400">
              Risk: {tooltip.node.riskScore}
            </p>
          )}
          {tooltip.edge?.ownershipPercentage != null && (
            <p className="text-xs text-zinc-400">
              Ownership: {tooltip.edge.ownershipPercentage}%
            </p>
          )}
        </div>
      )}

      {selectedNode && (
        <GraphNodeDetail
          node={selectedNode}
          edges={filteredEdges}
          investigationId={investigationId}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────

export function OwnershipGraph({ investigationId }: OwnershipGraphProps) {
  const { graphData, isLoading } = useGraphData(investigationId)
  const [config, setConfig] = useState<GraphConfig>(DEFAULT_GRAPH_CONFIG)
  const isMobile = useIsMobile()
  const svgExportRef = useRef<(() => void) | null>(null)
  const fitRef = useRef<(() => void) | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[600px] w-full rounded-lg" />
      </div>
    )
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No ownership structure"
        description="No ownership links have been recorded for this entity yet. Links are created from registry screening or manual entry."
      />
    )
  }

  if (isMobile) {
    return (
      <MobileTreeFallback
        nodes={graphData.nodes}
        edges={graphData.edges}
        investigationId={investigationId}
      />
    )
  }

  return (
    <div className="relative">
      <GraphControls
        config={config}
        onConfigChange={setConfig}
        onExportSvg={() => svgExportRef.current?.()}
        onFitToScreen={() => fitRef.current?.()}
      />
      <DesktopForceGraph
        nodes={graphData.nodes}
        edges={graphData.edges}
        config={config}
        investigationId={investigationId}
      />
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function getCountryFlag(code: string): string {
  if (!code || code.length < 2) return ''
  const upper = code.slice(0, 2).toUpperCase()
  try {
    return String.fromCodePoint(
      ...Array.from(upper).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    )
  } catch {
    return ''
  }
}
