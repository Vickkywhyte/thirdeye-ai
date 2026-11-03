'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink } from 'lucide-react'

interface SourceEvidenceCardProps {
  source: string
  matchScore: number
  matchedName: string | null
  severity: string
  data: Record<string, unknown>
  sourceUrl?: string
}

function severityColor(severity: string) {
  switch (severity) {
    case 'confirmed':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'possible':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'weak':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    default:
      return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
  }
}

function formatDataValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  return JSON.stringify(value)
}

const DISPLAY_KEYS = [
  'program',
  'listType',
  'position',
  'country',
  'schema',
  'headline',
  'domain',
  'date',
  'companyNumber',
  'status',
  'type',
  'dateOfCreation',
  'tone',
  'description',
]

export function SourceEvidenceCard({
  source,
  matchScore,
  matchedName,
  severity,
  data,
  sourceUrl,
}: SourceEvidenceCardProps) {
  const displayData = DISPLAY_KEYS.filter(
    (key) => data[key] !== undefined && data[key] !== null
  )

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-zinc-200">
            {matchedName ?? source}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={severityColor(severity)}
            >
              {severity}
            </Badge>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400">
              {matchScore}%
            </Badge>
          </div>
        </div>
        <p className="text-xs text-zinc-500">{source}</p>
      </CardHeader>
      <CardContent className="pt-2">
        {displayData.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {displayData.map((key) => (
              <div key={key} className="contents">
                <dt className="text-zinc-500 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </dt>
                <dd className="text-zinc-300 truncate">
                  {formatDataValue(data[key])}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            View source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  )
}
