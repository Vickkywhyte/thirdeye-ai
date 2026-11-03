'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

export function ContextualDrawer() {
  const { drawerOpen, drawerContent, closeDrawer } = useUIStore()
  const prefersReducedMotion = useReducedMotion()

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 300, damping: 30 }

  return (
    <AnimatePresence>
      {drawerOpen && drawerContent && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            onClick={closeDrawer}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 w-[380px] border-l border-border bg-background-secondary shadow-xl"
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={transition}
          >
            <div className="flex h-16 items-center justify-between px-6">
              <h2 className="text-lg font-semibold">
                {drawerContent.title}
              </h2>
              <Button variant="ghost" size="icon" onClick={closeDrawer}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Separator />
            <ScrollArea className="h-[calc(100vh-65px)]">
              <div className="p-6">{drawerContent.component}</div>
            </ScrollArea>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
