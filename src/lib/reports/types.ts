import type { ReportTemplate, ReportStatus } from '@/types/database'

export { type ReportTemplate, type ReportStatus }

export const REPORT_TEMPLATES: Record<ReportTemplate, { label: string; description: string }> = {
  standard_dd: {
    label: 'Full Due Diligence',
    description: 'Comprehensive due diligence report covering all screening areas',
  },
  enhanced_dd: {
    label: 'Enhanced Due Diligence',
    description: 'In-depth report with additional risk analysis and ownership mapping',
  },
  sanctions_alert: {
    label: 'Screening Summary',
    description: 'Summary of all screening results and key findings',
  },
  periodic_review: {
    label: 'Adverse Media Only',
    description: 'Focused report on adverse media findings and risk classification',
  },
}

export interface ReportSection {
  id: string
  title: string
  content: string
  order: number
  included: boolean
}

export interface ScreeningHitData {
  id: string
  source: string
  match_score: number
  matched_name: string | null
  data: Record<string, unknown>
  is_confirmed: boolean | null
}

export interface ScreeningResultData {
  id: string
  type: string
  status: string
  hit_count: number
  error_message: string | null
  hits: ScreeningHitData[]
}

export interface TimelineEventData {
  id: string
  event_type: string
  title: string
  description: string | null
  created_at: string
}

export interface AnalystNoteData {
  id: string
  content: string
  created_at: string
  author_name: string | null
}

export interface AiAnalysisData {
  summary: string
  keyFindings: string[]
  riskFactors: Array<{
    category: string
    severity: string
    description: string
    evidence: string
  }>
  recommendedActions: string[]
  overallAssessment: string
  confidenceScore: number
}

export interface ReportData {
  investigation: {
    id: string
    status: string
    risk_score: number | null
    created_at: string
    updated_at: string
  }
  entity: {
    id: string
    name: string
    type: string
    jurisdiction: string | null
    registration_number: string | null
  }
  screeningResults: ScreeningResultData[]
  aiAnalysis: AiAnalysisData | null
  timelineEvents: TimelineEventData[]
  analystNotes: AnalystNoteData[]
  generatedBy: string
  generatedAt: string
}
