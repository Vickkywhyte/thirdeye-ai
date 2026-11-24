'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useTheme } from 'next-themes'
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

// ── Node / edge helpers ───────────────────────────────────────

function nodeRadius(node: GraphNode): number {
  if (node.isSubject) return 36
  return 22
}

/** Determine visual shape category from node + connected edge type. */
function nodeShape(node: GraphNode, edges: GraphEdge[]): 'root' | 'company' | 'ubo' | 'director' {
  if (node.isSubject) return 'root'
  if (node.entityType === 'company') return 'company'
  const edge = edges.find((e) => e.source === node.id || e.target === node.id)
  if (edge) {
    if (edge.relationshipType === 'BENEFICIAL_OWNER' && (edge.ownershipPercentage ?? 0) >= 25) {
      return 'ubo'
    }
  }
  return 'director'
}

/** SVG polygon points for a flat-top hexagon centred at origin. */
function hexPoints(r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30)
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`
  }).join(' ')
}

/** SVG polygon points for a diamond centred at origin. */
function diamondPoints(r: number): string {
  return `0,${-r} ${r * 0.65},0 0,${r} ${-r * 0.65},0`
}

function edgeStrokeWidth(pct?: number): number {
  if (pct === undefined) return 1.5
  return 1.5 + (pct / 100) * 3
}

function edgeDashArray(type: GraphEdge['relationshipType']): string {
  switch (type) {
    case 'DIRECTOR':
    case 'CONTROLS':
      return '5 4'
    case 'BENEFICIAL_OWNER':
      return '8 3 2 3'
    default:
      return 'none'
  }
}

/** Human-readable tooltip role for a node given its edges. */
function nodeRoleLabel(node: GraphNode, edges: GraphEdge[]): string {
  if (node.isSubject) return 'Subject entity'
  if (node.entityType === 'company') return 'Holding company'
  const edge = edges.find((e) => e.source === node.id || e.target === node.id)
  if (!edge) return node.entityType
  switch (edge.relationshipType) {
    case 'DIRECTOR': return 'Director'
    case 'BENEFICIAL_OWNER': return edge.ownershipPercentage ? `Beneficial Owner (${edge.ownershipPercentage}%)` : 'Beneficial Owner'
    case 'OWNS': return edge.ownershipPercentage ? `Owner (${edge.ownershipPercentage}%)` : 'Owner'
    case 'CONTROLS': return 'Controller'
    case 'SHAREHOLDER': return 'Shareholder'
  }
}

/** Human-readable tooltip for an edge. */
function edgeLabel(edge: GraphEdge, nodes: GraphNode[]): string {
  const src = nodes.find((n) => n.id === edge.source)?.label ?? edge.source
  const tgt = nodes.find((n) => n.id === edge.target)?.label ?? edge.target
  const pct = edge.ownershipPercentage != null ? ` · ${edge.ownershipPercentage}%` : ''
  const rel = edge.relationshipType.replace('_', ' ').toLowerCase()
  return `${src} → ${tgt} [${rel}${pct}]`
}

/**
 * Tree layout: subject at top-centre, owners/companies above, directors below.
 * Falls back to BFS levels for deeper graphs.
 */
function computeTreeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const subject = nodes.find((n) => n.isSubject)
  const positions = new Map<string, { x: number; y: number }>()
  if (!subject || nodes.length === 0) return positions

  // Classify direct neighbours: upstream = own/control the subject, downstream = directors etc.
  const upstream = new Set<string>()
  const downstream = new Set<string>()
  for (const edge of edges) {
    if (edge.target === subject.id) upstream.add(edge.source)
    else if (edge.source === subject.id) downstream.add(edge.target)
  }

  const cx = width / 2
  const topPad = 80
  const bottomPad = 80

  // Subject in the upper-centre third
  const subjectY = nodes.length <= 3 ? height / 2 : topPad + (height - topPad - bottomPad) * 0.35
  positions.set(subject.id, { x: cx, y: subjectY })

  // Upstream nodes: evenly spread above subject
  const upArr = [...upstream]
  const upY = topPad + (subjectY - topPad) * 0.4
  upArr.forEach((id, i) => {
    positions.set(id, { x: (width / (upArr.length + 1)) * (i + 1), y: upY })
  })

  // Downstream nodes: evenly spread below subject
  const downArr = [...downstream].filter((id) => !upstream.has(id))
  const downY = subjectY + (height - subjectY - bottomPad) * 0.55
  downArr.forEach((id, i) => {
    positions.set(id, { x: (width / (downArr.length + 1)) * (i + 1), y: downY })
  })

  // Any remaining unplaced nodes → extra row at the bottom
  const remaining = nodes.filter((n) => !positions.has(n.id))
  remaining.forEach((n, i) => {
    positions.set(n.id, { x: (width / (remaining.length + 1)) * (i + 1), y: height - bottomPad })
  })

  return positions
}

/**
 * Radial layout: subject at centre, BFS rings spread outward.
 */
function computeRadialLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const subject = nodes.find((n) => n.isSubject)
  const positions = new Map<string, { x: number; y: number }>()
  if (!subject || nodes.length === 0) return positions

  const cx = width / 2
  const cy = height / 2
  const maxRadius = Math.min(width, height) * 0.42

  // BFS levels
  const levels = new Map<string, number>([[subject.id, 0]])
  const queue = [subject.id]
  while (queue.length > 0) {
    const cur = queue.shift()!
    const lvl = levels.get(cur)!
    for (const edge of edges) {
      const nb = edge.source === cur ? edge.target : edge.target === cur ? edge.source : null
      if (nb && !levels.has(nb)) { levels.set(nb, lvl + 1); queue.push(nb) }
    }
  }
  for (const n of nodes) if (!levels.has(n.id)) levels.set(n.id, Math.max(...levels.values()) + 1)

  const byLevel = new Map<number, string[]>()
  for (const [id, lvl] of levels) {
    if (!byLevel.has(lvl)) byLevel.set(lvl, [])
    byLevel.get(lvl)!.push(id)
  }

  const totalLevels = byLevel.size
  for (const [lvl, ids] of byLevel) {
    if (lvl === 0) { positions.set(ids[0], { x: cx, y: cy }); continue }
    const r = (lvl / totalLevels) * maxRadius
    const startAngle = -Math.PI / 2
    const step = (2 * Math.PI) / ids.length
    ids.forEach((id, i) => {
      const a = startAngle + step * i
      positions.set(id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
    })
  }

  return positions
}

/**
 * Force layout: D3 force simulation run synchronously for deterministic output.
 */
function computeForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) return new Map()

  interface SimNode extends d3.SimulationNodeDatum { id: string }
  interface SimLink extends d3.SimulationLinkDatum<SimNode> {}

  const simNodes: SimNode[] = nodes.map((n, i) => ({
    id: n.id,
    // Stagger initial positions slightly to avoid degenerate start
    x: width / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * 50,
    y: height / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * 50,
  }))

  const simLinks: SimLink[] = edges.map((e) => ({ source: e.source, target: e.target }))

  const sim = d3.forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      d3.forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(180)
        .strength(0.7)
    )
    .force('charge', d3.forceManyBody<SimNode>().strength(-700))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide<SimNode>().radius(72))
    .stop()

  for (let i = 0; i < 300; i++) sim.tick()

  const positions = new Map<string, { x: number; y: number }>()
  simNodes.forEach((n) => positions.set(n.id, { x: n.x ?? width / 2, y: n.y ?? height / 2 }))
  return positions
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
              parentInvestigationId={investigationId}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Desktop hierarchical graph ───────────────────────────────

type TooltipState =
  | { kind: 'node'; node: GraphNode; x: number; y: number }
  | { kind: 'edge'; label: string; x: number; y: number }

function DesktopForceGraph({
  nodes,
  edges,
  config,
  investigationId,
  onExportReady,
  onFitReady,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  config: GraphConfig
  investigationId: string
  onExportReady?: (fn: () => void) => void
  onFitReady?: (fn: () => void) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const { resolvedTheme } = useTheme()

  const isDark = resolvedTheme !== 'light'

  // Semantic colours that flip with theme
  const colors = {
    bg: isDark ? '#09090b' : '#ffffff',
    edge: isDark ? '#52525b' : '#a1a1aa',
    edgeLabel: isDark ? '#a1a1aa' : '#71717a',
    nodeText: isDark ? '#e4e4e7' : '#18181b',
    rootFill: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(37,99,235,0.1)',
    rootStroke: isDark ? '#3b82f6' : '#2563eb',
    companyFill: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.1)',
    companyStroke: isDark ? '#6366f1' : '#4f46e5',
    uboFill: isDark ? 'rgba(234,179,8,0.15)' : 'rgba(202,138,4,0.1)',
    uboStroke: isDark ? '#eab308' : '#ca8a04',
    directorFill: isDark ? 'rgba(107,114,128,0.15)' : 'rgba(107,114,128,0.1)',
    directorStroke: isDark ? '#6b7280' : '#9ca3af',
    linkedElsewhereStroke: isDark ? '#a855f7' : '#7c3aed',
  }

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

    const width = svg.clientWidth || 800
    const height = svg.clientHeight || 600

    let positions: Map<string, { x: number; y: number }>
    switch (config.layout) {
      case 'force':
        positions = computeForceLayout(filteredNodes, filteredEdges, width, height)
        break
      case 'radial':
        positions = computeRadialLayout(filteredNodes, filteredEdges, width, height)
        break
      default:
        positions = computeTreeLayout(filteredNodes, filteredEdges, width, height)
    }

    const d3svg = d3.select(svg)
    d3svg.selectAll('*').remove()

    // Background
    d3svg.append('rect').attr('width', width).attr('height', height).attr('fill', colors.bg)

    const g = d3svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString())
      })

    d3svg.call(zoom)
    zoomRef.current = zoom

    // Defs: arrow markers per edge style
    const defs = g.append('defs')
    const makeArrow = (id: string, color: string) => {
      defs.append('marker')
        .attr('id', id)
        .attr('viewBox', '0 0 10 6')
        .attr('refX', 10).attr('refY', 3)
        .attr('markerWidth', 7).attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,0 L10,3 L0,6 Z')
        .attr('fill', color)
    }
    makeArrow('arrow-edge', colors.edge)
    makeArrow('arrow-director', isDark ? '#6b7280' : '#9ca3af')

    // ── Edges ──
    const edgeGroup = g.append('g').attr('class', 'edges')

    for (const edge of filteredEdges) {
      const src = positions.get(edge.source)
      const tgt = positions.get(edge.target)
      if (!src || !tgt) continue

      const isDirector = edge.relationshipType === 'DIRECTOR' || edge.relationshipType === 'CONTROLS'
      const dash = edgeDashArray(edge.relationshipType)
      const sw = edgeStrokeWidth(edge.ownershipPercentage)
      const strokeColor = isDirector ? (isDark ? '#6b7280' : '#9ca3af') : colors.edge
      const markerEnd = isDirector ? 'url(#arrow-director)' : 'url(#arrow-edge)'

      // Offset line endpoints to touch the node border, not the centre.
      // This avoids the arrowhead being hidden under the node shape.
      const dx = tgt.x - src.x
      const dy = tgt.y - src.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const tgtR = nodeRadius(filteredNodes.find(n => n.id === edge.target) ?? filteredNodes[0])
      const ex = tgt.x - (dx / dist) * (tgtR + 6)
      const ey = tgt.y - (dy / dist) * (tgtR + 6)

      const line = edgeGroup.append('line')
        .attr('x1', src.x).attr('y1', src.y)
        .attr('x2', ex).attr('y2', ey)
        .attr('stroke', strokeColor)
        .attr('stroke-width', sw)
        .attr('marker-end', markerEnd)

      if (dash !== 'none') line.attr('stroke-dasharray', dash)

      // Edge label (percentage or relationship)
      const mx = (src.x + tgt.x) / 2
      const my = (src.y + tgt.y) / 2

      if (config.showPercentages && edge.ownershipPercentage != null) {
        edgeGroup.append('text')
          .attr('x', mx).attr('y', my - 6)
          .attr('text-anchor', 'middle')
          .attr('fill', colors.edgeLabel)
          .attr('font-size', '10px')
          .attr('font-family', 'var(--font-sans, system-ui)')
          .text(`${edge.ownershipPercentage}%`)
      }

      // Invisible wide hit area for edge hover tooltips
      edgeGroup.append('line')
        .attr('x1', src.x).attr('y1', src.y)
        .attr('x2', tgt.x).attr('y2', tgt.y)
        .attr('stroke', 'transparent')
        .attr('stroke-width', 12)
        .style('cursor', 'default')
        .on('mouseenter', (event) => {
          setTooltip({ kind: 'edge', label: edgeLabel(edge, filteredNodes), x: event.pageX, y: event.pageY })
        })
        .on('mouseleave', () => setTooltip(null))
    }

    // ── Nodes ──
    const nodeGroup = g.append('g').attr('class', 'nodes')

    for (const node of filteredNodes) {
      const pos = positions.get(node.id)
      if (!pos) continue

      const shape = nodeShape(node, filteredEdges)
      const r = nodeRadius(node)

      let fill: string
      let stroke: string
      switch (shape) {
        case 'root':
          fill = config.highlightRisk ? RISK_COLORS[riskLevel(node.riskScore)] + '26' : colors.rootFill
          stroke = config.highlightRisk ? RISK_COLORS[riskLevel(node.riskScore)] : colors.rootStroke
          break
        case 'company':
          fill = colors.companyFill; stroke = colors.companyStroke; break
        case 'ubo':
          fill = colors.uboFill; stroke = colors.uboStroke; break
        default:
          fill = config.highlightRisk && node.riskScore !== null
            ? RISK_COLORS[riskLevel(node.riskScore)] + '26'
            : colors.directorFill
          stroke = config.highlightRisk && node.riskScore !== null
            ? RISK_COLORS[riskLevel(node.riskScore)]
            : colors.directorStroke
      }

      // Purple override for nodes linked to other investigations
      if (node.isLinkedElsewhere && shape !== 'root') {
        stroke = colors.linkedElsewhereStroke
        fill = isDark ? 'rgba(168,85,247,0.12)' : 'rgba(124,58,237,0.08)'
      }

      const ng = nodeGroup.append('g')
        .attr('transform', `translate(${pos.x},${pos.y})`)
        .style('cursor', 'pointer')

      // Native browser tooltip with full name
      ng.append('title').text(node.label)

      // Subject outer ring
      if (shape === 'root') {
        ng.append('circle')
          .attr('r', r + 6)
          .attr('fill', 'none')
          .attr('stroke', colors.rootStroke)
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4 3')
          .attr('opacity', 0.5)
      }

      // Linked-elsewhere outer ring (purple dashed)
      if (node.isLinkedElsewhere && shape !== 'root') {
        ng.append('circle')
          .attr('r', r + 5)
          .attr('fill', 'none')
          .attr('stroke', colors.linkedElsewhereStroke)
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '3 2')
          .attr('opacity', 0.65)
      }

      // Shape
      if (shape === 'company') {
        ng.append('polygon')
          .attr('points', hexPoints(r))
          .attr('fill', fill)
          .attr('stroke', stroke)
          .attr('stroke-width', 2)
      } else if (shape === 'ubo') {
        ng.append('polygon')
          .attr('points', diamondPoints(r))
          .attr('fill', fill)
          .attr('stroke', stroke)
          .attr('stroke-width', 2)
      } else {
        ng.append('circle')
          .attr('r', r)
          .attr('fill', fill)
          .attr('stroke', stroke)
          .attr('stroke-width', shape === 'root' ? 2.5 : 1.5)
      }

      // Label
      if (config.showLabels) {
        const flag = node.country ? getCountryFlag(node.country) : ''
        const name = node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label
        ng.append('text')
          .attr('y', r + 15)
          .attr('text-anchor', 'middle')
          .attr('fill', colors.nodeText)
          .attr('font-size', '11px')
          .attr('font-weight', shape === 'root' ? '600' : '400')
          .attr('font-family', 'var(--font-sans, system-ui)')
          .text(flag ? `${flag} ${name}` : name)
      }

      // Hit area + interactions
      const hitR = r + 8
      ng.append('circle')
        .attr('r', hitR)
        .attr('fill', 'transparent')
        .on('click', () => {
          setTooltip(null)
          setSelectedNode(node)
        })
        .on('mouseenter', (event) => {
          if (selectedNode) return
          setTooltip({ kind: 'node', node, x: event.pageX, y: event.pageY })
        })
        .on('mouseleave', () => setTooltip(null))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNodes, filteredEdges, config, isDark, selectedNode])

  useEffect(() => {
    renderGraph()
  }, [renderGraph])

  useEffect(() => {
    onExportReady?.(() => {
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
    })
    onFitReady?.(() => {
      const svg = svgRef.current
      if (!svg || !zoomRef.current) return
      d3.select(svg).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity)
    })
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-lg border border-border">
      <svg ref={svgRef} className="h-full w-full" />
      <GraphLegend />

      {tooltip && !selectedNode && (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-border bg-card px-3 py-2 shadow-xl"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          {tooltip.kind === 'node' ? (
            <>
              <p className="text-sm font-semibold text-card-foreground">
                {tooltip.node.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {nodeRoleLabel(tooltip.node, filteredEdges)}
              </p>
              {tooltip.node.riskScore !== null && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Risk score: {tooltip.node.riskScore}
                </p>
              )}
              {tooltip.node.isLinkedElsewhere && (
                <p className="mt-0.5 text-xs text-purple-400">
                  Also linked to {tooltip.node.linkedInvestigationCount} other investigation{tooltip.node.linkedInvestigationCount !== 1 ? 's' : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{tooltip.label}</p>
          )}
        </div>
      )}

      {selectedNode && (
        <GraphNodeDetail
          node={selectedNode}
          edges={filteredEdges}
          investigationId={investigationId}
          parentInvestigationId={investigationId}
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
        onExportReady={(fn) => { svgExportRef.current = fn }}
        onFitReady={(fn) => { fitRef.current = fn }}
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
