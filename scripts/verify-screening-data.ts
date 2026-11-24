#!/usr/bin/env npx tsx
/**
 * Database proof: dump the raw rows the app depends on for a given
 * investigation, using the service-role key (bypasses RLS entirely).
 *
 * Usage: npx tsx scripts/verify-screening-data.ts <investigationId>
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal(): void {
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

async function main() {
  loadEnvLocal()

  const investigationId = process.argv[2]
  if (!investigationId) {
    console.error('Usage: npx tsx scripts/verify-screening-data.ts <investigationId>')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('════════════════════════════════════════════')
  console.log('DATABASE PROOF (service role / RLS bypassed)')
  console.log('investigation_id =', investigationId)
  console.log('════════════════════════════════════════════\n')

  const inv = await supabase
    .from('investigations')
    .select('*')
    .eq('id', investigationId)
    .maybeSingle()

  console.log('── investigations ──')
  console.log('error:', inv.error?.message ?? 'none')
  console.log(JSON.stringify(inv.data, null, 2))
  console.log()

  const screening = await supabase
    .from('screening_results')
    .select('*')
    .eq('investigation_id', investigationId)
    .order('created_at', { ascending: true })

  console.log('── screening_results ──')
  console.log('error:', screening.error?.message ?? 'none')
  console.log('ROW COUNT:', screening.data?.length ?? 0)
  console.log(JSON.stringify(screening.data, null, 2))
  console.log()

  const resultIds = (screening.data ?? []).map((r) => r.id)
  if (resultIds.length > 0) {
    const hits = await supabase
      .from('screening_hits')
      .select('*')
      .in('result_id', resultIds)
    console.log('── screening_hits ──')
    console.log('error:', hits.error?.message ?? 'none')
    console.log('ROW COUNT:', hits.data?.length ?? 0)
    console.log()
  }

  const timeline = await supabase
    .from('timeline_events')
    .select('*')
    .eq('investigation_id', investigationId)
    .order('created_at', { ascending: false })

  console.log('── timeline_events ──')
  console.log('error:', timeline.error?.message ?? 'none')
  console.log('ROW COUNT:', timeline.data?.length ?? 0)
  console.log(
    JSON.stringify(
      (timeline.data ?? []).map((t) => ({ title: t.title, type: t.event_type })),
      null,
      2
    )
  )
  console.log()

  // Does the org-scoped query the page uses actually match?
  if (inv.data) {
    const scoped = await supabase
      .from('investigations')
      .select('*')
      .eq('id', investigationId)
      .eq('org_id', inv.data.org_id)
      .maybeSingle()
    console.log('── org-scoped investigation query (what the page runs) ──')
    console.log('org_id:', inv.data.org_id)
    console.log('matched:', scoped.data ? 'YES' : 'NO')
    console.log()
  }

  // Full list of investigations, so we can confirm the ID is the right one.
  const all = await supabase
    .from('investigations')
    .select('id, org_id, entity_id, status, risk_score, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
  console.log('── 10 most recent investigations (sanity check) ──')
  console.log(JSON.stringify(all.data, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
