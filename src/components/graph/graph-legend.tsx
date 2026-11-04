'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { RISK_COLORS } from '@/lib/graph/types'

const RISK_LABELS: Array<{ key: string; label: string }> = [
  { key: 'critical', label: 'Critical (80-100)' },
  { key: 'high', label: 'High (60-79)' },
  { key: 'medium', label: 'Medium (40-59)' },
  { key: 'low', label: 'Low (0-39)' },
  { key: 'unknown', label: 'Unknown' },
]

const THICKNESS_LEGEND = [
  { label: '10%', width: 1 },
  { label: '50%', width: 2.5 },
  { label: '100%', width: 4 },
]

const RELATIONSHIP_LABELS = [
  { label: 'Owns', style: 'solid' },
  { label: 'Controls', style: 'dashed' },
  { label: 'Director', style: 'dotted' },
  { label: 'Beneficial Owner', style: 'double' },
]

export function GraphLegend() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 backdrop-blur-sm">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between text-xs font-medium text-zinc-300"
      >
        Legend
        {collapsed ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {!collapsed && (
        <div className="mt-2 space-y-3">
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Risk Level
            </p>
            <div className="space-y-1">
              {RISK_LABELS.map((r) => (
                <div key={r.key} className="flex items-center gap-2 text-[11px]">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: RISK_COLORS[r.key] }}
                  />
                  <span className="text-zinc-400">{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Ownership %
            </p>
            <div className="space-y-1">
              {THICKNESS_LEGEND.map((t) => (
                <div key={t.label} className="flex items-center gap-2 text-[11px]">
                  <svg width="24" height="8">
                    <line
                      x1="0"
                      y1="4"
                      x2="24"
                      y2="4"
                      stroke="#9CA3AF"
                      strokeWidth={t.width}
                    />
                  </svg>
                  <span className="text-zinc-400">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Relationship
            </p>
            <div className="space-y-1">
              {RELATIONSHIP_LABELS.map((r) => (
                <div key={r.label} className="flex items-center gap-2 text-[11px]">
                  <svg width="24" height="8">
                    <line
                      x1="0"
                      y1="4"
                      x2="24"
                      y2="4"
                      stroke="#9CA3AF"
                      strokeWidth={1.5}
                      strokeDasharray={
                        r.style === 'dashed'
                          ? '4 2'
                          : r.style === 'dotted'
                            ? '1 2'
                            : r.style === 'double'
                              ? '6 2 2 2'
                              : undefined
                      }
                    />
                  </svg>
                  <span className="text-zinc-400">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
