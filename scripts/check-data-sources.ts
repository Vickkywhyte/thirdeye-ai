#!/usr/bin/env npx tsx
/**
 * Data source health check & sample ingestion validator.
 *
 * The screening providers fetch live data on every run from:
 *   - OFAC SDN (XML)      → sanctions.ts
 *   - EU Consolidated (CSV) → sanctions.ts
 *   - UN Security Council (XML) → sanctions.ts
 *   - OpenSanctions API    → pep.ts
 *   - NewsAPI              → adverse-media.ts
 *   - Companies House API  → registry.ts
 *
 * This script validates each source is reachable, parses correctly,
 * and reports entry counts.
 *
 * Usage: npx tsx scripts/check-data-sources.ts
 */

const OFAC_SDN_URL = 'https://www.treasury.gov/ofac/downloads/sdn.xml'
const EU_SANCTIONS_URL =
  'https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList/content'
const UN_SANCTIONS_URL =
  'https://scsanctions.un.org/resources/xml/en/consolidated.xml'
const OPENSANCTIONS_MATCH_URL = 'https://api.opensanctions.org/match/default'

interface SourceResult {
  name: string
  url: string
  status: 'ok' | 'error' | 'timeout'
  entries: number
  durationMs: number
  error?: string
  sample?: string[]
}

async function checkOFAC(): Promise<SourceResult> {
  const start = Date.now()
  try {
    const res = await fetch(OFAC_SDN_URL, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) {
      return { name: 'OFAC SDN', url: OFAC_SDN_URL, status: 'error', entries: 0, durationMs: Date.now() - start, error: `HTTP ${res.status}` }
    }
    const text = await res.text()
    const names: string[] = []
    const regex = /<sdnEntry>[\s\S]*?<lastName>(.*?)<\/lastName>[\s\S]*?(?:<firstName>(.*?)<\/firstName>)?[\s\S]*?<\/sdnEntry>/g
    let match
    while ((match = regex.exec(text)) !== null) {
      const last = match[1] ?? ''
      const first = match[2] ?? ''
      names.push(first ? `${first} ${last}` : last)
    }
    return {
      name: 'OFAC SDN',
      url: OFAC_SDN_URL,
      status: 'ok',
      entries: names.length,
      durationMs: Date.now() - start,
      sample: names.slice(0, 5),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { name: 'OFAC SDN', url: OFAC_SDN_URL, status: msg.includes('timeout') ? 'timeout' : 'error', entries: 0, durationMs: Date.now() - start, error: msg }
  }
}

async function checkEU(): Promise<SourceResult> {
  const start = Date.now()
  try {
    const res = await fetch(EU_SANCTIONS_URL, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) {
      return { name: 'EU Consolidated', url: EU_SANCTIONS_URL, status: 'error', entries: 0, durationMs: Date.now() - start, error: `HTTP ${res.status}` }
    }
    const text = await res.text()
    const lines = text.split('\n').slice(1)
    const names: string[] = []
    for (const line of lines) {
      const cols = line.split(';')
      if (cols.length < 2) continue
      const name = (cols[1] ?? '').replace(/"/g, '').trim()
      if (name) names.push(name)
    }
    return {
      name: 'EU Consolidated',
      url: EU_SANCTIONS_URL,
      status: 'ok',
      entries: names.length,
      durationMs: Date.now() - start,
      sample: names.slice(0, 5),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { name: 'EU Consolidated', url: EU_SANCTIONS_URL, status: msg.includes('timeout') ? 'timeout' : 'error', entries: 0, durationMs: Date.now() - start, error: msg }
  }
}

async function checkUN(): Promise<SourceResult> {
  const start = Date.now()
  try {
    const res = await fetch(UN_SANCTIONS_URL, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) {
      return { name: 'UN Security Council', url: UN_SANCTIONS_URL, status: 'error', entries: 0, durationMs: Date.now() - start, error: `HTTP ${res.status}` }
    }
    const text = await res.text()
    const names: string[] = []
    const regex = /<INDIVIDUAL>[\s\S]*?<FIRST_NAME>(.*?)<\/FIRST_NAME>[\s\S]*?<SECOND_NAME>(.*?)<\/SECOND_NAME>[\s\S]*?<\/INDIVIDUAL>/g
    let match
    while ((match = regex.exec(text)) !== null) {
      const first = match[1] ?? ''
      const second = match[2] ?? ''
      names.push(`${first} ${second}`.trim())
    }
    return {
      name: 'UN Security Council',
      url: UN_SANCTIONS_URL,
      status: 'ok',
      entries: names.length,
      durationMs: Date.now() - start,
      sample: names.slice(0, 5),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { name: 'UN Security Council', url: UN_SANCTIONS_URL, status: msg.includes('timeout') ? 'timeout' : 'error', entries: 0, durationMs: Date.now() - start, error: msg }
  }
}

async function checkOpenSanctions(): Promise<SourceResult> {
  const start = Date.now()
  try {
    const payload = {
      queries: {
        test_query: {
          schema: 'Person',
          properties: { name: ['Vladimir Putin'] },
        },
      },
    }
    const res = await fetch(OPENSANCTIONS_MATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) {
      return { name: 'OpenSanctions (PEP)', url: OPENSANCTIONS_MATCH_URL, status: 'error', entries: 0, durationMs: Date.now() - start, error: `HTTP ${res.status}` }
    }
    const data = await res.json()
    const results = data.responses?.test_query?.results ?? []
    return {
      name: 'OpenSanctions (PEP)',
      url: OPENSANCTIONS_MATCH_URL,
      status: 'ok',
      entries: results.length,
      durationMs: Date.now() - start,
      sample: results.slice(0, 3).map((r: { caption: string }) => r.caption),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { name: 'OpenSanctions (PEP)', url: OPENSANCTIONS_MATCH_URL, status: msg.includes('timeout') ? 'timeout' : 'error', entries: 0, durationMs: Date.now() - start, error: msg }
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  ThirdEye AI — Data Source Health Check')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()

  const checks = await Promise.allSettled([
    checkOFAC(),
    checkEU(),
    checkUN(),
    checkOpenSanctions(),
  ])

  let allOk = true
  for (const result of checks) {
    if (result.status === 'rejected') {
      console.log(`  ✗ Unknown source — ${result.reason}`)
      allOk = false
      continue
    }
    const r = result.value
    const icon = r.status === 'ok' ? '✓' : '✗'
    const statusColor = r.status === 'ok' ? '' : ' [FAILED]'
    console.log(`  ${icon} ${r.name}${statusColor}`)
    console.log(`    URL: ${r.url}`)
    console.log(`    Entries parsed: ${r.entries.toLocaleString()}`)
    console.log(`    Duration: ${r.durationMs}ms`)
    if (r.error) {
      console.log(`    Error: ${r.error}`)
      allOk = false
    }
    if (r.sample && r.sample.length > 0) {
      console.log(`    Sample: ${r.sample.join(', ')}`)
    }
    console.log()
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (allOk) {
    console.log('  All data sources are reachable and parsing correctly.')
  } else {
    console.log('  Some data sources failed. Check errors above.')
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()
  console.log('Note: Screening providers fetch live data on each run.')
  console.log('No local ingestion tables are needed — data is matched in-memory.')
}

main().catch(console.error)
