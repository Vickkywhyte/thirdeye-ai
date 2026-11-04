import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const start = performance.now()
  let dbOk = false

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('entities').select('id').limit(1)
    dbOk = !error
  } catch {
    dbOk = false
  }

  const durationMs = Math.round(performance.now() - start)
  const status = dbOk ? 'healthy' : 'degraded'

  return Response.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: { database: dbOk ? 'ok' : 'fail' },
      durationMs,
    },
    { status: dbOk ? 200 : 503 }
  )
}
