import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/session'
import { NavRail } from '@/components/layout/nav-rail'
import { TopBar } from '@/components/layout/top-bar'
import { ContextualDrawer } from '@/components/layout/contextual-drawer'
import { CommandPalette } from '@/components/layout/command-palette'

export const instant = false

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <NavRail user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <ContextualDrawer />
      <CommandPalette />
    </div>
  )
}
