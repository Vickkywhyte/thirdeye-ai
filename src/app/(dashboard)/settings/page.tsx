import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { SettingsTabs } from '@/components/settings/settings-tabs'

export const instant = false

export default async function SettingsPage() {
  await connection()

  const user = await getUser()
  if (!user) redirect('/login')
  if (!hasPermission(user.role, 'settings:read')) redirect('/dashboard')

  const supabase = await createClient()
  const { data: org } = await supabase
    .from('organisations')
    .select('id, name, slug, settings')
    .eq('id', user.orgId)
    .single()

  const orgSettings = (org?.settings ?? {}) as Record<string, unknown>
  const retentionDays =
    typeof orgSettings.retention_days === 'number'
      ? orgSettings.retention_days
      : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile and organisation preferences
        </p>
      </div>

      <SettingsTabs
        user={{
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        }}
        org={{
          id: org?.id ?? user.orgId,
          name: org?.name ?? 'Unknown',
          slug: org?.slug ?? '',
          retentionDays,
          canUpdateOrg: hasPermission(user.role, 'org:update'),
        }}
      />
    </div>
  )
}
