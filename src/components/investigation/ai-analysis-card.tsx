'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

interface RiskFactor {
  category: string
  severity: string
  description: string
  evidence: string
}

interface AiAnalysis {
  summary: string
  keyFindings: string[]
  riskFactors: RiskFactor[]
  recommendedActions: string[]
  overallAssessment: string
  confidenceScore: number
  isAiGenerated: boolean
  provider?: string
  tokensUsed?: number
}

function assessmentColor(assessment: string) {
  switch (assessment) {
    case 'critical':
      return 'border-red-500/30 bg-red-500/10 text-red-400'
    case 'high':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-400'
    case 'medium':
      return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
    case 'low':
      return 'border-green-500/30 bg-green-500/10 text-green-400'
    default:
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400'
  }
}

function severityIcon(severity: string) {
  switch (severity) {
    case 'critical':
    case 'high':
      return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
    case 'medium':
      return <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
    default:
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
  }
}

export function AiAnalysisCard({
  investigationId,
  hasScreeningResults,
}: {
  investigationId: string
  hasScreeningResults: boolean
}) {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/investigations/${investigationId}/ai-analysis`
      )
      if (res.ok) {
        const json = await res.json()
        setAnalysis(json.data?.analysis ?? null)
      }
    } catch {
      // ignore fetch errors on initial load
    } finally {
      setLoading(false)
    }
  }, [investigationId])

  useEffect(() => {
    fetchAnalysis()
  }, [fetchAnalysis])

  async function triggerAnalysis() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/investigations/${investigationId}/ai-analysis`,
        { method: 'POST' }
      )
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to generate analysis')
        return
      }
      const json = await res.json()
      setAnalysis(json.data?.analysis ?? null)
    } catch {
      setError('Failed to connect to AI service')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Analysis</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </CardContent>
      </Card>
    )
  }

  if (generating) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">AI Analysis</CardTitle>
            <Badge
              variant="outline"
              className="border-purple-500/30 bg-purple-500/10 text-purple-400"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              AI Generated
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <Brain className="h-10 w-10 text-purple-400 animate-pulse" />
            <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-purple-300 animate-ping" />
          </div>
          <p className="mt-4 text-sm text-zinc-400">Analysing screening data…</p>
          <p className="mt-1 text-xs text-zinc-600">
            This may take 15–30 seconds
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Analysis</CardTitle>
          <CardDescription>Automated risk assessment summary</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Brain className="h-10 w-10 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">
            {hasScreeningResults
              ? 'Generate an AI-powered risk analysis from screening results.'
              : 'Run screening first to enable AI analysis.'}
          </p>
          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}
          <Button
            className="mt-4"
            size="sm"
            disabled={!hasScreeningResults}
            onClick={triggerAnalysis}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Generate AI Analysis
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">AI Analysis</CardTitle>
            {analysis.isAiGenerated && (
              <Badge
                variant="outline"
                className="border-purple-500/30 bg-purple-500/10 text-purple-400"
              >
                <Sparkles className="mr-1 h-3 w-3" />
                AI Generated
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={triggerAnalysis}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Regenerate
          </Button>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Badge
            variant="outline"
            className={assessmentColor(analysis.overallAssessment)}
          >
            {analysis.overallAssessment.toUpperCase()} RISK
          </Badge>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-24 rounded-full bg-zinc-800">
              <div
                className="h-1.5 rounded-full bg-purple-500 transition-all"
                style={{
                  width: `${Math.round(analysis.confidenceScore * 100)}%`,
                }}
              />
            </div>
            <span className="text-xs text-zinc-500">
              {Math.round(analysis.confidenceScore * 100)}% confidence
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-line">
          {analysis.summary}
        </p>

        {analysis.keyFindings.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Key Findings
            </h4>
            <ul className="space-y-1.5">
              {analysis.keyFindings.map((finding, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.riskFactors.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Risk Factors
            </h4>
            <div className="space-y-2">
              {analysis.riskFactors.map((factor, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 p-2.5"
                >
                  {severityIcon(factor.severity)}
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-300">
                      {factor.description}
                    </p>
                    {factor.evidence && (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {factor.evidence}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.recommendedActions.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Recommended Actions
            </h4>
            <ol className="list-decimal space-y-1 pl-4">
              {analysis.recommendedActions.map((action, i) => (
                <li key={i} className="text-sm text-zinc-300">
                  {action}
                </li>
              ))}
            </ol>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </CardContent>
    </Card>
  )
}
