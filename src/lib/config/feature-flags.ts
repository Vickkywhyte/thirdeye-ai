export const FEATURE_FLAGS = {
  AI_ANALYSIS: 'FEATURE_AI_ANALYSIS',
  PDF_EXPORT: 'FEATURE_PDF_EXPORT',
  OWNERSHIP_GRAPH: 'FEATURE_OWNERSHIP_GRAPH',
  ADVERSE_MEDIA: 'FEATURE_ADVERSE_MEDIA',
} as const

export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const value = process.env[flag]
  return value === 'true' || value === '1'
}
