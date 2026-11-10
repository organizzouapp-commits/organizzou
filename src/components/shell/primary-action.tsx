"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"

/** An entry of the split button's menu (desktop header): the main click keeps doing `onClick`. */
export type PrimaryMenuItem = { id: string; label: string; icon?: LucideIcon; onSelect: () => void }

type PrimaryAction = { label: string; onClick: () => void; menu?: PrimaryMenuItem[] }

type PrimaryActionContextValue = {
  quick: PrimaryMenuItem[] | null
  setQuick: (items: PrimaryMenuItem[] | null) => void
  action: PrimaryAction | null
  setAction: (action: PrimaryAction | null) => void
}

const PrimaryActionContext = createContext<PrimaryActionContextValue>({ action: null, setAction: () => {}, quick: null, setQuick: () => {} })

export function PrimaryActionProvider({ children }: { children: React.ReactNode }) {
  const [action, setAction] = useState<PrimaryAction | null>(null)
  const [quick, setQuick] = useState<PrimaryMenuItem[] | null>(null)
  return <PrimaryActionContext.Provider value={{ action, setAction, quick, setQuick }}>{children}</PrimaryActionContext.Provider>
}

/** What the "+ Novo" button in the top bar does on the current screen. */
export function usePrimaryActionValue() {
  return useContext(PrimaryActionContext).action
}

/**
 * Screens call this to claim the top bar's primary button, e.g. `usePrimaryAction("Nova tarefa", openDialog)`.
 * With `menu` the button becomes a split button: the main part runs `onClick`, the chevron opens the menu.
 * When the screen unmounts the button goes back to opening quick capture.
 */
export function usePrimaryAction(label: string, onClick: () => void, menu?: PrimaryMenuItem[]) {
  const { setAction } = useContext(PrimaryActionContext)
  const latest = useRef(onClick)
  const latestMenu = useRef(menu)

  useEffect(() => {
    latest.current = onClick
    latestMenu.current = menu
  })

  // The menu is re-registered only when its entries change (ids and labels), not on every render.
  const menuKey = menu ? menu.map((item) => `${item.id}:${item.label}`).join("|") : ""
  useEffect(() => {
    const items = latestMenu.current?.map((item) => ({ ...item, onSelect: () => latestMenu.current?.find((m) => m.id === item.id)?.onSelect() }))
    setAction({ label, onClick: () => latest.current(), menu: items })
    return () => setAction(null)
  }, [label, menuKey, setAction])
}

/** The screen's actions for the quick-actions button, when they differ from its header button (e.g. per tab). */
export function useQuickActionsValue() {
  return useContext(PrimaryActionContext).quick
}

/**
 * A screen registers what the quick-actions button offers on it (closest to the button first), with the same handlers as its own UI.
 * Registered on mount, dropped on unmount; the handlers are read at click time, so they are never stale.
 */
export function useQuickActions(items: PrimaryMenuItem[] | null) {
  const { setQuick } = useContext(PrimaryActionContext)
  const latest = useRef(items)
  useEffect(() => {
    latest.current = items
  })
  const key = items ? items.map((item) => `${item.id}:${item.label}`).join("|") : ""
  useEffect(() => {
    const current = latest.current
    setQuick(current ? current.map((item) => ({ ...item, onSelect: () => latest.current?.find((m) => m.id === item.id)?.onSelect() })) : null)
    return () => setQuick(null)
  }, [key, setQuick])
}
