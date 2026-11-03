import { create } from 'zustand'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  timestamp: Date
  read: boolean
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  addNotification: (
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    }
    set((s) => ({
      notifications: [newNotification, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    }))
  },

  markAsRead: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id)
      if (!target || target.read) return s
      return {
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: s.unreadCount - 1,
      }
    }),

  markAllAsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  removeNotification: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id)
      return {
        notifications: s.notifications.filter((n) => n.id !== id),
        unreadCount: target && !target.read ? s.unreadCount - 1 : s.unreadCount,
      }
    }),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}))
