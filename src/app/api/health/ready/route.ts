import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('entities').select('id').limit(1)

    if (error) {
      return Response.json(
        { ready: false, reason: 'database unreachable' },
        { status: 503 }
      )
    }

    return Response.json({ ready: true }, { status: 200 })
  } catch {
    return Response.json(
      { ready: false, reason: 'internal error' },
      { status: 503 }
    )
  }
}
