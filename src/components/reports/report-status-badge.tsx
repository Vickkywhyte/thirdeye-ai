'use client'

import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; className: string; spinning?: boolean }> = {
  draft: {
    label: 'Draft',
    className: 'border-zinc-500/30 bg-zinc-500/20 text-zinc-400',
  },
  in_review: {
    label: 'Generating',
    className: 'border-blue-500/30 bg-blue-500/20 text-blue-400',
    spinning: true,
  },
  final: {
    label: 'Ready',
    className: 'border-green-500/30 bg-green-500/20 text-green-400',
  },
  archived: {
    label: 'Archived',
    className: 'border-red-500/30 bg-red-500/20 text-red-400',
  },
}

export function ReportStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft

  return (
    <Badge variant="outline" className={config.className}>
      {config.spinning && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
      {config.label}
    </Badge>
  )
}
