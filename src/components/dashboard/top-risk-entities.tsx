'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RiskScoreRing } from '@/components/investigation/risk-score-ring'
import { relativeTime } from '@/lib/utils/formatting'
import type { TopRiskEntity } from '@/lib/analytics/queries'

interface TopRiskEntitiesProps {
  data: TopRiskEntity[] | undefined
}

export function TopRiskEntities({ data }: TopRiskEntitiesProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Top Risk Entities</CardTitle>
        <Link
          href="/investigations?sort=risk_score&dir=desc"
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          View All
        </Link>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-zinc-500">No high-risk entities</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((entity) => (
              <Link
                key={entity.id}
                href={`/investigations/${entity.investigationId}`}
                className="flex items-center justify-between rounded-lg border border-zinc-800 p-3 transition-colors hover:bg-zinc-900"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <RiskScoreRing score={entity.riskScore} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {entity.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className="border-zinc-700 text-zinc-500 text-[10px]"
                      >
                        {entity.entityType}
                      </Badge>
                      {entity.lastScreened && (
                        <span className="text-[10px] text-zinc-600">
                          {relativeTime(entity.lastScreened)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
