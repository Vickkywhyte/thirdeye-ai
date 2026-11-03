import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function assertServerSide(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient() must only be called server-side. ' +
        'The service role key must never be exposed to the browser.',
    )
  }
}

export function createAdminClient() {
  assertServerSide()

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
