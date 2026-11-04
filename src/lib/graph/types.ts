export interface GraphNode {
  id: string
  label: string
  entityType: string
  riskScore: number | null
  country: string | null
  registrationNumber: string | null
  isSubject: boolean
  metadata: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relationshipType:
    | 'OWNS'
    | 'CONTROLS'
    | 'DIRECTOR'
    | 'SHAREHOLDER'
    | 'BENEFICIAL_OWNER'
  ownershipPercentage?: number
  isDirectLink: boolean
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type GraphLayout = 'force' | 'tree' | 'radial'

export interface GraphConfig {
  layout: GraphLayout
  showLabels: boolean
  showPercentages: boolean
  highlightRisk: boolean
  minOwnershipThreshold: number
}

export const LINK_TYPE_TO_RELATIONSHIP: Record<string, GraphEdge['relationshipType']> = {
  ownership: 'OWNS',
  control: 'CONTROLS',
  nominee: 'DIRECTOR',
  beneficial_owner: 'BENEFICIAL_OWNER',
  other: 'SHAREHOLDER',
}

export const RISK_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
  unknown: '#6B7280',
}

export function riskLevel(score: number | null): string {
  if (score === null) return 'unknown'
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  layout: 'force',
  showLabels: true,
  showPercentages: true,
  highlightRisk: true,
  minOwnershipThreshold: 0,
}
