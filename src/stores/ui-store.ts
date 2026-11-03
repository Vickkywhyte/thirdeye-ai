import { create } from 'zustand'
import type { ReactNode } from 'react'

export type DrawerContent = {
  title: string
  component: ReactNode
} | null

interface UIState {
  navExpanded: boolean
  toggleNav: () => void
  setNavExpanded: (expanded: boolean) => void

  drawerOpen: boolean
  drawerContent: DrawerContent
  openDrawer: (content: NonNullable<DrawerContent>) => void
  closeDrawer: () => void

  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  navExpanded: true,
  toggleNav: () => set((s) => ({ navExpanded: !s.navExpanded })),
  setNavExpanded: (expanded) => set({ navExpanded: expanded }),

  drawerOpen: false,
  drawerContent: null,
  openDrawer: (content) => set({ drawerOpen: true, drawerContent: content }),
  closeDrawer: () => set({ drawerOpen: false, drawerContent: null }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}))
