import { createClient } from '@/lib/supabase/server'
import type { Tables, UserRole } from '@/types/database'

export type AuthUser = {
  id: string
  email: string
  role: UserRole
  orgId: string
  fullName: string
}

export async function getSession() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id, full_name')
    .eq('id', authUser.id)
    .single()

  if (!profile) return null

  return {
    id: authUser.id,
    email: authUser.email!,
    role: profile.role,
    orgId: profile.org_id,
    fullName: profile.full_name,
  }
}

export async function getUserProfile(): Promise<Tables<'users'> | null> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return data
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
