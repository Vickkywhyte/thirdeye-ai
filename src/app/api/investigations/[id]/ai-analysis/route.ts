import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateRiskAnalysis } from '@/lib/ai/risk-scoring'
import {
  apiSuccess,
  apiCreated,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from '@/lib/api/response'
import { handleApiError } from '@/lib/api/error-handler'
import { validateUUID } from '@/lib/security/input-validator'
import { aiAnalysisRateLimiter } from '@/lib/security/rate-limiter'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'investigations:read')) return apiForbidden()

    const { id } = await params
    validateUUID(id)
    const supabase = await createClient()

    const { data: investigation, error } = await supabase
      .from('investigations')
      .select('summary')
      .eq('id', id)
      .single()

    if (error || !investigation) {
      return apiError('Investigation not found', 404)
    }

    if (!investigation.summary) {
      return apiSuccess({ analysis: null })
    }

    try {
      const analysis = JSON.parse(investigation.summary)
      return apiSuccess({ analysis })
    } catch {
      return apiSuccess({
        analysis: {
          summary: investigation.summary,
          keyFindings: [],
          riskFactors: [],
          recommendedActions: [],
          overallAssessment: 'medium',
          confidenceScore: 0.5,
          isAiGenerated: false,
        },
      })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const ip = (request.headers.get('x-forwarded-for') ?? 'unknown')
    const { allowed } = aiAnalysisRateLimiter(`${ip}:ai-analysis`)
    if (!allowed) {
      return apiError('Too many requests. Please try again later.', 429)
    }

    const user = await getUser()
    if (!user) return apiUnauthorized()
    if (!hasPermission(user.role, 'screening:run')) return apiForbidden()

    const { id } = await params
    validateUUID(id)
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: investigation, error: invError } = await supabase
      .from('investigations')
      .select('*')
      .eq('id', id)
      .single()

    if (invError || !investigation) {
      return apiError('Investigation not found', 404)
    }

    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', investigation.entity_id)
      .single()

    if (entityError || !entity) {
      return apiError('Entity not found', 404)
    }

    const { data: screeningResults } = await supabase
      .from('screening_results')
      .select('*')
      .eq('investigation_id', id)

    const completedResults = (screeningResults ?? []).filter(
      (r) => r.status === 'completed'
    )

    if (completedResults.length === 0) {
      return apiError(
        'No completed screening results found. Run screening first.',
        400
      )
    }

    const resultsWithHits = await Promise.all(
      completedResults.map(async (r) => {
        const { data: hits } = await supabase
          .from('screening_hits')
          .select('*')
          .eq('result_id', r.id)
        return {
          type: r.type,
          status: r.status,
          hit_count: r.hit_count,
          screening_hits: (hits ?? []).map((h) => ({
            source: h.source,
            match_score: h.match_score,
            matched_name: h.matched_name,
            data: h.data as Record<string, unknown>,
          })),
        }
      })
    )

    const analysis = await generateRiskAnalysis(
      {
        id: investigation.id,
        entity: {
          name: entity.name,
          type: entity.type,
          jurisdiction: entity.jurisdiction,
          registration_number: entity.registration_number,
        },
        risk_score: investigation.risk_score,
      },
      resultsWithHits
    )

    await admin
      .from('investigations')
      .update({ summary: JSON.stringify(analysis) })
      .eq('id', id)

    await admin.from('timeline_events').insert({
      investigation_id: id,
      event_type: 'ai_analysis',
      title: 'AI risk analysis generated',
      description: `Overall assessment: ${analysis.overallAssessment}. Confidence: ${Math.round(analysis.confidenceScore * 100)}%. Provider: ${analysis.provider}. ${analysis.keyFindings.length} key findings identified.`,
    })

    return apiCreated({ analysis })
  } catch (error) {
    return handleApiError(error)
  }
}
