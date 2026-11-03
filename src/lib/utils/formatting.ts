import { formatDistanceToNow, format } from 'date-fns'
import { RISK_LEVELS, type RiskLevel } from './constants'

export function formatDate(date: string | Date, pattern = 'dd MMM yyyy'): string {
  return format(new Date(date), pattern)
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy, HH:mm')
}

export function relativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function riskScoreToLevel(score: number): RiskLevel {
  if (score >= RISK_LEVELS.CRITICAL.minScore) return 'CRITICAL'
  if (score >= RISK_LEVELS.HIGH.minScore) return 'HIGH'
  if (score >= RISK_LEVELS.MEDIUM.minScore) return 'MEDIUM'
  return 'LOW'
}

export function riskScoreToLabel(score: number): string {
  return RISK_LEVELS[riskScoreToLevel(score)].label
}

export function riskScoreToColor(score: number): string {
  return RISK_LEVELS[riskScoreToLevel(score)].color
}

const compactFormatter = new Intl.NumberFormat('en-GB', { notation: 'compact' })
const standardFormatter = new Intl.NumberFormat('en-GB')
const percentFormatter = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export function formatNumber(value: number): string {
  return standardFormatter.format(value)
}

export function formatCompactNumber(value: number): string {
  return compactFormatter.format(value)
}

export function formatPercent(value: number): string {
  return percentFormatter.format(value)
}
