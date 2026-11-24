'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const SIZES = {
  sm: { size: 48, stroke: 4, fontSize: 'text-xs' },
  md: { size: 80, stroke: 6, fontSize: 'text-lg' },
  lg: { size: 120, stroke: 8, fontSize: 'text-2xl' },
} as const

function getScoreColor(score: number): string {
  if (score >= 80) return '#EF4444'
  if (score >= 60) return '#F97316'
  if (score >= 40) return '#EAB308'
  return '#22C55E'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Critical'
  if (score >= 60) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}

export interface ScoreBreakdownItem {
  label: string
  contribution: number
  hitCount: number
}

interface RiskScoreRingProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
  breakdown?: ScoreBreakdownItem[]
}

function RiskRingSvg({
  score,
  size = 'md',
  className,
}: Omit<RiskScoreRingProps, 'breakdown'>) {
  const prefersReducedMotion = useReducedMotion()
  const config = SIZES[size]
  const radius = (config.size - config.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(100, Math.max(0, score)) / 100
  const offset = circumference * (1 - progress)
  const color = getScoreColor(score)

  return (
    <div
      className={cn(
        'group relative inline-flex items-center justify-center',
        className
      )}
      style={{ width: config.size, height: config.size }}
    >
      <svg
        width={config.size}
        height={config.size}
        viewBox={`0 0 ${config.size} ${config.size}`}
        className="-rotate-90"
      >
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.stroke}
          className="text-muted/50"
        />
        <motion.circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 60, damping: 15, duration: 0.8 }
          }
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
          className="transition-[filter] group-hover:[filter:drop-shadow(0_0_8px_var(--glow-color))]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold leading-none', config.fontSize)}>
          {score}
        </span>
        {size !== 'sm' && (
          <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
            {getScoreLabel(score)}
          </span>
        )}
      </div>
      <style>{`
        .group:hover circle:last-of-type {
          --glow-color: ${color}80;
        }
      `}</style>
    </div>
  )
}

export function RiskScoreRing({
  score,
  size = 'md',
  className,
  breakdown,
}: RiskScoreRingProps) {
  if (!breakdown || breakdown.length === 0) {
    return <RiskRingSvg score={score} size={size} className={className} />
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            <RiskRingSvg score={score} size={size} className={className} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="w-56 p-3">
          <p className="mb-2 text-xs font-semibold text-foreground">Score breakdown</p>
          <div className="space-y-1">
            {breakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={item.contribution > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                  {item.hitCount === 0
                    ? '+0 (no hits)'
                    : `+${item.contribution} (${item.hitCount} hit${item.hitCount !== 1 ? 's' : ''})`}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs font-semibold">
            <span>Total</span>
            <span>{score}/100</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
