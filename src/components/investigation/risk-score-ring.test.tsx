import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RiskScoreRing } from './risk-score-ring'

vi.mock('framer-motion', () => ({
  motion: {
    circle: (props: Record<string, unknown>) => {
      const { initial, animate, transition, ...rest } = props
      return <circle {...rest} />
    },
  },
  useReducedMotion: () => false,
}))

afterEach(() => {
  cleanup()
})

describe('RiskScoreRing', () => {
  it('renders without crashing', () => {
    const { container } = render(<RiskScoreRing score={50} />)
    expect(container).toBeTruthy()
  })

  it('displays the correct score value', () => {
    render(<RiskScoreRing score={75} />)
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('shows "Low" label for low risk', () => {
    render(<RiskScoreRing score={20} />)
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('shows "Medium" label for medium risk', () => {
    render(<RiskScoreRing score={50} />)
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('shows "High" label for high risk', () => {
    render(<RiskScoreRing score={70} />)
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('shows "Critical" label for critical risk', () => {
    render(<RiskScoreRing score={90} />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('renders sm size without label', () => {
    render(<RiskScoreRing score={50} size="sm" />)
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.queryByText('Medium')).not.toBeInTheDocument()
  })

  it('renders md size with label', () => {
    render(<RiskScoreRing score={50} size="md" />)
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('renders lg size with label', () => {
    render(<RiskScoreRing score={85} size="lg" />)
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('renders an SVG element', () => {
    const { container } = render(<RiskScoreRing score={50} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
