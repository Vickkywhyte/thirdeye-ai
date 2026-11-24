'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registerSchema } from '@/lib/validation/schemas'

export type RegisterResult =
  | { success: true }
  | { success: false; error: string }

export async function registerUser(formData: {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  organisationName: string
}): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { fullName, email, password, organisationName } = parsed.data
  const admin = createAdminClient()

  const slug = organisationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  const { data: orgData, error: orgError } = await admin
    .from('organisations')
    .insert({ name: organisationName, slug })
    .select('id')
    .single()

  if (orgError) {
    console.error('Org creation error:', orgError)
    return { success: false, error: orgError.message }
  }

  // Use the server client (with cookies) for signUp so the session is set.
  // The on_auth_user_created trigger reads org_id from raw_user_meta_data
  // and inserts the public.users row automatically.
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        org_id: orgData.id,
        role: 'owner',
      },
    },
  })

  if (authError) {
    console.error('Auth signUp error:', authError)
    // Clean up the orphaned org
    await admin.from('organisations').delete().eq('id', orgData.id)
    return { success: false, error: authError.message }
  }

  // If email confirmation is enabled, authData.user exists but there's
  // no session yet. The trigger still fires and creates the profile row.
  if (!authData.user) {
    await admin.from('organisations').delete().eq('id', orgData.id)
    return { success: false, error: 'Failed to create user account' }
  }

  // If email confirmation is required, let the user know
  if (!authData.session) {
    return { success: true }
  }

  return { success: true }
}
