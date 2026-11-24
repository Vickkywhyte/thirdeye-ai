import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { EmptyState } from '@/components/shared/empty-state'
import { ReviewsInbox } from '@/components/reviews/reviews-inbox'

export const instant = false

export default async function ReviewsPage() {
  await connection()
  const user = await getUser()
  if (!user) redirect('/login')

  if (!hasPermission(user.role, 'reviews:read')) {
    return (
      <EmptyState
        title="Access denied"
        description="You do not have permission to view reviews."
      />
    )
  }

  const supabase = createAdminClient()

  // Admin client bypasses RLS; scope read explicitly by org.
  const { data: investigations } = await supabase
    .from('investigations')
    .select('id, entity:entities!inner(name)')
    .eq('org_id', user.orgId)

  const entityDirectory: Record<string, { entityName: string }> = {}
  for (const inv of investigations ?? []) {
    const entity = Array.isArray(inv.entity) ? inv.entity[0] : inv.entity
    entityDirectory[inv.id] = {
      entityName: entity?.name ?? 'Unknown entity',
    }
  }

  return <ReviewsInbox userRole={user.role} entityDirectory={entityDirectory} />
}
