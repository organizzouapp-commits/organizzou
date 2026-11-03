"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

import type { PanelId } from "@/features/today/catalog"

/** One module card open at a time on "Hoje". Outside the page (stories, tests) the context falls back to a card-local no-op. */
type Api = { openId: PanelId | null; toggle: (id: PanelId) => void }

const Context = createContext<Api | null>(null)

export function ModuleAccordionProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<PanelId | null>(null)
  const toggle = useCallback((id: PanelId) => setOpenId((current) => (current === id ? null : id)), [])
  const value = useMemo(() => ({ openId, toggle }), [openId, toggle])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useModuleAccordion() {
  return useContext(Context)
}
