"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { toast } from "sonner"

import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions"
import type { AppNotification } from "@/features/notifications/types"

type Api = {
  items: AppNotification[]
  unread: number
  markRead: (id: string) => void
  markAllRead: () => void
}

const Context = createContext<Api>({ items: [], unread: 0, markRead: () => {}, markAllRead: () => {} })
export const useNotifications = () => useContext(Context)

/**
 * The bell's list, shared by every bell on the page (the phone mounts two). The server sends the latest notifications; reading one
 * changes the screen at once and is saved, and if the database refuses the change is undone with an honest message.
 */
export function NotificationsProvider({ initial, children }: { initial: AppNotification[]; children: React.ReactNode }) {
  const [items, setItems] = useState(initial)

  const markRead = useCallback((id: string) => {
    const stamp = new Date().toISOString()
    let was: string | null | undefined
    setItems((list) => list.map((n) => (n.id === id ? ((was = n.read_at), { ...n, read_at: n.read_at ?? stamp }) : n)))
    if (was) return
    void markNotificationRead({ id, read: true }).then((result) => {
      if (result.ok) return
      setItems((list) => list.map((n) => (n.id === id ? { ...n, read_at: null } : n)))
      toast.error(result.error)
    })
  }, [])

  const markAllRead = useCallback(() => {
    const stamp = new Date().toISOString()
    const before = items
    setItems((list) => list.map((n) => ({ ...n, read_at: n.read_at ?? stamp })))
    void markAllNotificationsRead().then((result) => {
      if (result.ok) return
      setItems(before)
      toast.error(result.error)
    })
  }, [items])

  const value = useMemo(() => ({ items, unread: items.filter((n) => !n.read_at).length, markRead, markAllRead }), [items, markRead, markAllRead])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
