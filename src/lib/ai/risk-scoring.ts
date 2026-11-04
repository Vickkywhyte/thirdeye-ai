import { generateCompletion } from './provider'
import { RISK_ANALYSIS_PROMPT } from './prompts'
import { sanitizeForPrompt } from './sanitize'

export interface RiskFactor {
  category: string
  severity: string
  description: string
  evidence: string
}

export interface RiskAnalysis {
  summary: string
  keyFindings: string[]
  riskFactors: RiskFactor[]
  recommendedActions: string[]
  overallAssessment: string
  confidenceScore: number
  isAiGenerated: true
  provider: string
  tokensUsed: number
}

interface ScreeningResultInput {
  type: string
  status: string
  hit_count: number
  screening_hits?: Array<{
    source: string
    match_score: number
    matched_name: string | null
    data: Record<string, unknown>
  }>
}

interface InvestigationInput {
  id: string
  entity: {
    name: string
    type: string
    jurisdiction: string | null
    registration_number: string | null
  }
  risk_score: number | null
}

function buildAnalysisPrompt(
  investigation: InvestigationInput,
  screeningResults: ScreeningResultInput[]
): string {
  const entityInfo = sanitizeForPrompt(
    `Entity: ${investigation.entity.name}
Type: ${investigation.entity.type}
Jurisdiction: ${investigation.entity.jurisdiction ?? 'Unknown'}
Registration: ${investigation.entity.registration_number ?? 'N/A'}
Current Risk Score: ${investigation.risk_score ?? 'Not scored'}`
  )

  const resultsInfo = screeningResults
    .map((r) => {
      const hitsDetail =
        r.screening_hits
          ?.slice(0, 10)
          .map(
            (h) =>
              `  - ${sanitizeForPrompt(h.source)}: ${sanitizeForPrompt(h.matched_name ?? 'N/A')} (score: ${h.match_score})`
          )
          .join('\n') ?? '  No hits'

      return sanitizeForPrompt(
        `${r.type.toUpperCase()} (${r.status}): ${r.hit_count} hits\n${hitsDetail}`
      )
    })
    .join('\n\n')

  return `${entityInfo}\n\nScreening Results:\n${resultsInfo}`
}

function parseAnalysisResponse(text: string): Omit<RiskAnalysis, 'isAiGenerated' | 'provider' | 'tokensUsed'> {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON object found in AI response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis could not be generated.',
    keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
    riskFactors: Array.isArray(parsed.riskFactors)
      ? parsed.riskFactors.map((rf: Record<string, unknown>) => ({
          category: String(rf.category ?? 'unknown'),
          severity: String(rf.severity ?? 'medium'),
          description: String(rf.description ?? ''),
          evidence: String(rf.evidence ?? ''),
        }))
      : [],
    recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [],
    overallAssessment: typeof parsed.overallAssessment === 'string' ? parsed.overallAssessment : 'medium',
    confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
  }
}

export async function generateRiskAnalysis(
  investigation: InvestigationInput,
  screeningResults: ScreeningResultInput[]
): Promise<RiskAnalysis> {
  const prompt = buildAnalysisPrompt(investigation, screeningResults)

  const completion = await generateCompletion(prompt, {
    systemPrompt: RISK_ANALYSIS_PROMPT,
    maxTokens: 2048,
    temperature: 0.3,
  })

  const analysis = parseAnalysisResponse(completion.text)

  return {
    ...analysis,
    isAiGenerated: true,
    provider: completion.provider,
    tokensUsed: completion.tokensUsed,
  }
}
