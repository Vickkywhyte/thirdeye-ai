import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sanctionsProvider } from './sanctions'

const MOCK_OFAC_XML = `<?xml version="1.0"?>
<sdnList>
  <sdnEntry>
    <lastName>EXAMPLE CORP</lastName>
  </sdnEntry>
  <sdnEntry>
    <lastName>DOE</lastName>
    <firstName>JOHN</firstName>
    <aka>
      <lastName>DOE</lastName>
      <firstName>JOHNNY</firstName>
    </aka>
  </sdnEntry>
</sdnList>`

const MOCK_EU_CSV = `header1;header2\n1;"EXAMPLE CORP";data`
const MOCK_UN_XML = `<?xml version="1.0"?>
<CONSOLIDATED_LIST>
  <INDIVIDUALS>
    <INDIVIDUAL>
      <FIRST_NAME>JOHN</FIRST_NAME>
      <SECOND_NAME>DOE</SECOND_NAME>
    </INDIVIDUAL>
  </INDIVIDUALS>
</CONSOLIDATED_LIST>`

beforeEach(() => {
  vi.restoreAllMocks()
})

function mockFetchResponses() {
  let callCount = 0
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    callCount++
    if (callCount === 1) {
      return Promise.resolve(new Response(MOCK_OFAC_XML, { status: 200 }))
    }
    if (callCount === 2) {
      return Promise.resolve(new Response(MOCK_EU_CSV, { status: 200 }))
    }
    return Promise.resolve(new Response(MOCK_UN_XML, { status: 200 }))
  })
}

describe('sanctionsProvider', () => {
  it('has type "sanctions"', () => {
    expect(sanctionsProvider.type).toBe('sanctions')
  })

  it('returns hits for an exact name match', async () => {
    mockFetchResponses()

    const result = await sanctionsProvider.screen({
      name: 'John Doe',
      type: 'individual',
    })

    expect(result.type).toBe('sanctions')
    expect(result.hits.length).toBeGreaterThan(0)

    const topHit = result.hits[0]
    expect(topHit.matchScore).toBeGreaterThanOrEqual(80)
    expect(topHit.source).toBeDefined()
    expect(topHit.matchedName).toBeDefined()
    expect(topHit.severity).toBeDefined()
    expect(topHit.data).toBeDefined()
  })

  it('returns no hits for an unrelated name', async () => {
    mockFetchResponses()

    const result = await sanctionsProvider.screen({
      name: 'Completely Unrelated Name XYZ123',
      type: 'individual',
    })

    expect(result.hits.length).toBe(0)
  })

  it('finds near-matches via similarity', async () => {
    mockFetchResponses()

    const result = await sanctionsProvider.screen({
      name: 'Jon Doe',
      type: 'individual',
    })

    expect(result.hits.length).toBeGreaterThan(0)
  })

  it('returns correct ScreeningResult structure', async () => {
    mockFetchResponses()

    const result = await sanctionsProvider.screen({
      name: 'Example Corp',
      type: 'company',
    })

    expect(result).toHaveProperty('type')
    expect(result).toHaveProperty('hits')
    expect(result).toHaveProperty('rawData')
    expect(Array.isArray(result.hits)).toBe(true)

    if (result.hits.length > 0) {
      const hit = result.hits[0]
      expect(hit).toHaveProperty('source')
      expect(hit).toHaveProperty('matchScore')
      expect(hit).toHaveProperty('matchedName')
      expect(hit).toHaveProperty('severity')
      expect(hit).toHaveProperty('data')
    }
  })

  it('classifies high-score matches as confirmed severity', async () => {
    mockFetchResponses()

    const result = await sanctionsProvider.screen({
      name: 'JOHN DOE',
      type: 'individual',
    })

    const exactHit = result.hits.find((h) => h.matchScore >= 85)
    if (exactHit) {
      expect(exactHit.severity).toBe('confirmed')
    }
  })

  it('handles fetch failures gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const result = await sanctionsProvider.screen({
      name: 'John Doe',
      type: 'individual',
    })

    expect(result.type).toBe('sanctions')
    expect(result.hits).toEqual([])
  })
})
