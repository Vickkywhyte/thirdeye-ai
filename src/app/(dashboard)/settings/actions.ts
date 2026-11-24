'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'

export type UpdateProfileState = {
  success?: boolean
  error?: string
}

export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const fullName = (formData.get('fullName') as string | null)?.trim()
  if (!fullName || fullName.length < 2) {
    return { error: 'Name must be at least 2 characters' }
  }
  if (fullName.length > 100) {
    return { error: 'Name must be 100 characters or fewer' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ full_name: fullName })
    .eq('id', user.id)

  if (error) return { error: 'Failed to update profile. Please try again.' }

  revalidatePath('/settings')
  return { success: true }
}
