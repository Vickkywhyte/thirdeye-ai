'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  LayoutDashboard,
  Search,
  Settings,
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

const PAGES = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Investigations', href: '/investigations', icon: Search },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
] as const

export function CommandPalette() {
  const router = useRouter()
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
    },
    [commandPaletteOpen, setCommandPaletteOpen]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function navigateTo(href: string) {
    setCommandPaletteOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {PAGES.map((page) => (
            <CommandItem
              key={page.href}
              onSelect={() => navigateTo(page.href)}
            >
              <page.icon className="mr-2 h-4 w-4" />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => navigateTo('/investigations')}
          >
            <Search className="mr-2 h-4 w-4" />
            New Investigation
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
