import { createClient } from '@/lib/supabase/server'
import type {
  ReportData,
  ScreeningResultData,
  AiAnalysisData,
} from './types'

export async function buildReportData(
  investigationId: string,
  userName: string
): Promise<ReportData> {
  const supabase = await createClient()

  const { data: investigation, error: invErr } = await supabase
    .from('investigations')
    .select('*')
    .eq('id', investigationId)
    .single()

  if (invErr || !investigation) {
    throw new Error('Investigation not found or access denied')
  }

  const { data: entity, error: entErr } = await supabase
    .from('entities')
    .select('*')
    .eq('id', investigation.entity_id)
    .single()

  if (entErr || !entity) {
    throw new Error('Entity not found')
  }

  const { data: screeningRows } = await supabase
    .from('screening_results')
    .select('*')
    .eq('investigation_id', investigationId)
    .order('created_at', { ascending: true })

  const screeningResults: ScreeningResultData[] = await Promise.all(
    (screeningRows ?? []).map(async (r) => {
      const { data: hits } = await supabase
        .from('screening_hits')
        .select('*')
        .eq('result_id', r.id)
        .order('match_score', { ascending: false })

      return {
        id: r.id,
        type: r.type,
        status: r.status,
        hit_count: r.hit_count,
        error_message: r.error_message,
        hits: (hits ?? []).map((h) => ({
          id: h.id,
          source: h.source,
          match_score: h.match_score,
          matched_name: h.matched_name,
          data: h.data as Record<string, unknown>,
          is_confirmed: h.is_confirmed,
        })),
      }
    })
  )

  let aiAnalysis: AiAnalysisData | null = null
  if (investigation.summary) {
    try {
      const parsed = JSON.parse(investigation.summary)
      if (parsed.summary && parsed.keyFindings) {
        aiAnalysis = parsed as AiAnalysisData
      }
    } catch {
      // summary is plain text, not JSON
    }
  }

  const { data: timelineRows } = await supabase
    .from('timeline_events')
    .select('*')
    .eq('investigation_id', investigationId)
    .order('created_at', { ascending: false })

  const { data: noteRows } = await supabase
    .from('analyst_notes')
    .select('*')
    .eq('investigation_id', investigationId)
    .order('created_at', { ascending: false })

  return {
    investigation: {
      id: investigation.id,
      status: investigation.status,
      risk_score: investigation.risk_score,
      created_at: investigation.created_at,
      updated_at: investigation.updated_at,
    },
    entity: {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      jurisdiction: entity.jurisdiction,
      registration_number: entity.registration_number,
    },
    screeningResults,
    aiAnalysis,
    timelineEvents: (timelineRows ?? []).map((e) => ({
      id: e.id,
      event_type: e.event_type,
      title: e.title,
      description: e.description,
      created_at: e.created_at,
    })),
    analystNotes: (noteRows ?? []).map((n) => ({
      id: n.id,
      content: n.content,
      created_at: n.created_at,
      author_name: null,
    })),
    generatedBy: userName,
    generatedAt: new Date().toISOString(),
  }
}
