'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  LayoutDashboard,
  Search,
  FileText,
  Flag,
  CalendarClock,
  Settings,
  ChevronLeft,
  ChevronRight,
  Eye,
  Siren,
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/rbac'

type NavItem = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  gate?: (user: AuthUser) => boolean
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Alerts', href: '/alerts', icon: Siren },
  { label: 'Investigations', href: '/investigations', icon: Search },
  {
    label: 'Escalations',
    href: '/escalations',
    icon: Flag,
    gate: (u) => hasPermission(u.role, 'escalations:resolve'),
  },
  { label: 'Reviews', href: '/reviews', icon: CalendarClock },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export function NavRail({ user }: { user: AuthUser }) {
  const pathname = usePathname()
  const { navExpanded, toggleNav } = useUIStore()
  const prefersReducedMotion = useReducedMotion()
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    fetch('/api/alerts?limit=50')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data?.total) setAlertCount(json.data.total)
      })
      .catch(() => {/* non-fatal */})
  }, [pathname])

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 300, damping: 30 }

  return (
    <motion.aside
      className="flex h-full flex-col border-r border-sidebar-border bg-sidebar"
      animate={{ width: navExpanded ? 240 : 64 }}
      transition={transition}
    >
      <div className="flex h-16 items-center gap-2 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-blue">
          <Eye className="h-4 w-4 text-white" />
        </div>
        {navExpanded && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            className="whitespace-nowrap text-lg font-bold text-sidebar-foreground"
          >
            ThirdEye <span className="text-accent-blue">AI</span>
          </motion.span>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 space-y-1 p-2">
        <TooltipProvider delayDuration={0}>
          {NAV_ITEMS.filter((item) => !item.gate || item.gate(user)).map((item) => {
            const isActive = pathname.startsWith(item.href)
            const isAlerts = item.href === '/alerts'
            const badge = isAlerts && alertCount > 0 ? alertCount : 0

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-accent-blue'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <span className="relative shrink-0">
                  <item.icon className="h-5 w-5" />
                  {badge > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                {navExpanded && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={
                      prefersReducedMotion ? { duration: 0 } : undefined
                    }
                    className="flex flex-1 items-center justify-between whitespace-nowrap"
                  >
                    {item.label}
                    {badge > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </motion.span>
                )}
              </Link>
            )

            if (!navExpanded) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                    {badge > 0 && ` (${badge})`}
                  </TooltipContent>
                </Tooltip>
              )
            }
            return <div key={item.href}>{linkContent}</div>
          })}
        </TooltipProvider>
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleNav}
          className="w-full justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground"
        >
          {navExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>
    </motion.aside>
  )
}
