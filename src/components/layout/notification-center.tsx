'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  FileText,
  Link2,
  RefreshCw,
  Search,
  Shield,
  CheckCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface NotificationEvent {
  id: string
  event_type: string
  title: string
  description: string | null
  created_at: string
  investigation_id: string
  entity_name: string | null
}

function eventIcon(eventType: string) {
  if (eventType.startsWith('screening')) {
    return <Shield className="h-4 w-4 shrink-0 text-blue-400" />
  }
  if (eventType.startsWith('report')) {
    return <FileText className="h-4 w-4 shrink-0 text-purple-400" />
  }
  if (eventType === 'child_investigation_opened') {
    return <Link2 className="h-4 w-4 shrink-0 text-cyan-400" />
  }
  if (eventType.startsWith('investigation')) {
    return <Search className="h-4 w-4 shrink-0 text-green-400" />
  }
  if (eventType === 'status_changed') {
    return <RefreshCw className="h-4 w-4 shrink-0 text-yellow-400" />
  }
  return <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function NotificationCenter() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<NotificationEvent[]>([])
  // null = not yet loaded from server; '' = never marked (all events are unread)
  const [lastReadAt, setLastReadAt] = useState<string | null | undefined>(undefined)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const json = await res.json()
        setEvents(json.data?.notifications ?? [])
        // Only update lastReadAt on initial load (undefined), not on subsequent refreshes,
        // so a just-clicked "mark all read" doesn't get reverted by the refetch
        setLastReadAt((prev) => prev === undefined ? (json.data?.last_read_at ?? null) : prev)
      }
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const unreadCount = events.filter((e) => {
    if (!lastReadAt) return true
    return new Date(e.created_at) > new Date(lastReadAt)
  }).length

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen)
    if (isOpen) fetchEvents()
  }

  async function handleMarkAllRead() {
    const now = new Date().toISOString()
    setLastReadAt(now)
    try {
      await fetch('/api/notifications', { method: 'PATCH' })
    } catch {
      // best-effort: state already updated optimistically
    }
  }

  function handleClickEvent(event: NotificationEvent) {
    setOpen(false)
    router.push(`/investigations/${event.investigation_id}`)
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-risk-critical text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-muted-foreground"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((event) => {
              const isUnread = !lastReadAt || new Date(event.created_at) > new Date(lastReadAt)
              return (
                <li key={event.id}>
                  <button
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                    onClick={() => handleClickEvent(event)}
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      {eventIcon(event.event_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium leading-snug text-foreground">
                          {event.title}
                        </p>
                        {isUnread && (
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                      {event.entity_name && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {event.entity_name}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        {relativeTime(event.created_at)}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="border-t border-border px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => { setOpen(false); router.push('/investigations') }}
          >
            View all investigations
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
