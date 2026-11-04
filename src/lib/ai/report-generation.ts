import { generateCompletion } from './provider'
import { REPORT_NARRATIVE_PROMPT, ADVERSE_MEDIA_CLASSIFICATION_PROMPT } from './prompts'
import { sanitizeForPrompt } from './sanitize'

export interface ReportSection {
  narrative: string
  dataSources: string[]
  limitations: string[]
  confidenceScore: number
  isAiGenerated: true
  provider: string
  tokensUsed: number
}

export interface MediaClassification {
  relevanceScore: number
  category: string
  subcategories: string[]
  summary: string
  keyEntities: string[]
  riskIndicators: string[]
  confidenceScore: number
  isAiGenerated: true
  provider: string
  tokensUsed: number
}

interface InvestigationData {
  entityName: string
  entityType: string
  jurisdiction: string | null
  riskScore: number | null
  screeningSummary: string
  additionalContext?: string
}

export type SectionType =
  | 'executive_summary'
  | 'entity_profile'
  | 'sanctions_screening'
  | 'pep_screening'
  | 'adverse_media'
  | 'registry_verification'
  | 'risk_assessment'
  | 'recommendations'

const SECTION_INSTRUCTIONS: Record<SectionType, string> = {
  executive_summary:
    'Write an executive summary covering the scope, key findings, and overall risk level of this investigation.',
  entity_profile:
    'Write a detailed entity profile section covering corporate structure, jurisdiction, and key identifiers.',
  sanctions_screening:
    'Write the sanctions screening results section, covering all lists checked and any matches found.',
  pep_screening:
    'Write the PEP screening section, covering political exposure checks and any connections identified.',
  adverse_media:
    'Write the adverse media section, summarising relevant news coverage and its implications for risk.',
  registry_verification:
    'Write the registry verification section, covering corporate registry checks and beneficial ownership findings.',
  risk_assessment:
    'Write the overall risk assessment section, synthesising all findings into a cohesive risk evaluation.',
  recommendations:
    'Write the recommendations section with specific, actionable next steps based on the investigation findings.',
}

export async function generateReportSection(
  sectionType: SectionType,
  investigationData: InvestigationData
): Promise<ReportSection> {
  const sectionInstruction = SECTION_INSTRUCTIONS[sectionType]

  const prompt = `Section to generate: ${sectionType.replace(/_/g, ' ').toUpperCase()}

${sectionInstruction}

Investigation Data:
Entity: ${sanitizeForPrompt(investigationData.entityName)}
Type: ${sanitizeForPrompt(investigationData.entityType)}
Jurisdiction: ${sanitizeForPrompt(investigationData.jurisdiction ?? 'Unknown')}
Risk Score: ${investigationData.riskScore ?? 'Not scored'}

Screening Summary:
${sanitizeForPrompt(investigationData.screeningSummary)}
${investigationData.additionalContext ? `\nAdditional Context:\n${sanitizeForPrompt(investigationData.additionalContext)}` : ''}`

  const completion = await generateCompletion(prompt, {
    systemPrompt: REPORT_NARRATIVE_PROMPT,
    maxTokens: 1500,
    temperature: 0.4,
  })

  const jsonMatch = completion.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      narrative: completion.text,
      dataSources: [],
      limitations: ['AI response was not in expected JSON format'],
      confidenceScore: 0.3,
      isAiGenerated: true,
      provider: completion.provider,
      tokensUsed: completion.tokensUsed,
    }
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    narrative: typeof parsed.narrative === 'string' ? parsed.narrative : completion.text,
    dataSources: Array.isArray(parsed.dataSources) ? parsed.dataSources : [],
    limitations: Array.isArray(parsed.limitations) ? parsed.limitations : [],
    confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
    isAiGenerated: true,
    provider: completion.provider,
    tokensUsed: completion.tokensUsed,
  }
}

export async function classifyAdverseMedia(article: {
  headline: string
  content: string
  source: string
  date: string
}): Promise<MediaClassification> {
  const prompt = `Classify this news article:

Headline: ${sanitizeForPrompt(article.headline)}
Source: ${sanitizeForPrompt(article.source)}
Date: ${sanitizeForPrompt(article.date)}
Content: ${sanitizeForPrompt(article.content)}`

  const completion = await generateCompletion(prompt, {
    systemPrompt: ADVERSE_MEDIA_CLASSIFICATION_PROMPT,
    maxTokens: 1024,
    temperature: 0.2,
  })

  const jsonMatch = completion.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      relevanceScore: 0.5,
      category: 'unclassified',
      subcategories: [],
      summary: 'Classification could not be completed.',
      keyEntities: [],
      riskIndicators: [],
      confidenceScore: 0.3,
      isAiGenerated: true,
      provider: completion.provider,
      tokensUsed: completion.tokensUsed,
    }
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    relevanceScore: typeof parsed.relevanceScore === 'number' ? parsed.relevanceScore : 0.5,
    category: typeof parsed.category === 'string' ? parsed.category : 'unclassified',
    subcategories: Array.isArray(parsed.subcategories) ? parsed.subcategories : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    keyEntities: Array.isArray(parsed.keyEntities) ? parsed.keyEntities : [],
    riskIndicators: Array.isArray(parsed.riskIndicators) ? parsed.riskIndicators : [],
    confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
    isAiGenerated: true,
    provider: completion.provider,
    tokensUsed: completion.tokensUsed,
  }
}
