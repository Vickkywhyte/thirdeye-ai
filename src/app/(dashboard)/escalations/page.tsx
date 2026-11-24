import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { EmptyState } from '@/components/shared/empty-state'
import { EscalationsInbox } from '@/components/escalations/escalations-inbox'

export const instant = false

export default async function EscalationsPage() {
  await connection()
  const user = await getUser()
  if (!user) redirect('/login')

  const canCreate = hasPermission(user.role, 'escalations:create')
  const canResolve = hasPermission(user.role, 'escalations:resolve')
  if (!canCreate && !canResolve) {
    return (
      <EmptyState
        title="Access denied"
        description="You do not have permission to view escalations."
      />
    )
  }

  const supabase = createAdminClient()

  // Admin client bypasses RLS; we scope reads explicitly by org below.
  const [usersRes, investigationsRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name')
      .eq('org_id', user.orgId),
    supabase
      .from('investigations')
      .select('id, entity_id, entity:entities!inner(name)')
      .eq('org_id', user.orgId),
  ])

  const userDirectory: Record<string, string> = {}
  for (const u of usersRes.data ?? []) {
    userDirectory[u.id] = u.full_name
  }

  const entityDirectory: Record<string, { entityName: string }> = {}
  for (const inv of investigationsRes.data ?? []) {
    const entity = Array.isArray(inv.entity) ? inv.entity[0] : inv.entity
    entityDirectory[inv.id] = {
      entityName: entity?.name ?? 'Unknown entity',
    }
  }

  return (
    <EscalationsInbox
      userRole={user.role}
      userDirectory={userDirectory}
      entityDirectory={entityDirectory}
    />
  )
}
