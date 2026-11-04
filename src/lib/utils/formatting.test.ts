import { describe, it, expect } from 'vitest'
import {
  formatDate,
  relativeTime,
  riskScoreToLabel,
  riskScoreToColor,
  formatNumber,
} from './formatting'

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2024-01-15T12:00:00Z')
    expect(result).toBe('15 Jan 2024')
  })

  it('formats a Date object', () => {
    const result = formatDate(new Date('2024-06-01'))
    expect(result).toContain('Jun')
    expect(result).toContain('2024')
  })
})

describe('relativeTime', () => {
  it('returns a relative time string', () => {
    const recent = new Date(Date.now() - 60000).toISOString()
    const result = relativeTime(recent)
    expect(result).toContain('ago')
  })
})

describe('riskScoreToLabel', () => {
  it('returns Low for score 0', () => {
    expect(riskScoreToLabel(0)).toBe('Low')
  })

  it('returns Low for score 39', () => {
    expect(riskScoreToLabel(39)).toBe('Low')
  })

  it('returns Medium for score 40', () => {
    expect(riskScoreToLabel(40)).toBe('Medium')
  })

  it('returns Medium for score 59', () => {
    expect(riskScoreToLabel(59)).toBe('Medium')
  })

  it('returns High for score 60', () => {
    expect(riskScoreToLabel(60)).toBe('High')
  })

  it('returns High for score 79', () => {
    expect(riskScoreToLabel(79)).toBe('High')
  })

  it('returns Critical for score 80', () => {
    expect(riskScoreToLabel(80)).toBe('Critical')
  })

  it('returns Critical for score 100', () => {
    expect(riskScoreToLabel(100)).toBe('Critical')
  })
})

describe('riskScoreToColor', () => {
  it('returns green for low risk', () => {
    expect(riskScoreToColor(0)).toBe('#22C55E')
    expect(riskScoreToColor(39)).toBe('#22C55E')
  })

  it('returns yellow for medium risk', () => {
    expect(riskScoreToColor(40)).toBe('#EAB308')
    expect(riskScoreToColor(59)).toBe('#EAB308')
  })

  it('returns orange for high risk', () => {
    expect(riskScoreToColor(60)).toBe('#F97316')
    expect(riskScoreToColor(79)).toBe('#F97316')
  })

  it('returns red for critical risk', () => {
    expect(riskScoreToColor(80)).toBe('#EF4444')
    expect(riskScoreToColor(100)).toBe('#EF4444')
  })
})

describe('formatNumber', () => {
  it('formats thousands with separator', () => {
    const result = formatNumber(1234567)
    expect(result).toMatch(/1[,.]234[,.]567/)
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})
