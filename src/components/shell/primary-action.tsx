"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"

type PrimaryAction = { label: string; onClick: () => void }

type PrimaryActionContextValue = {
  action: PrimaryAction | null
  setAction: (action: PrimaryAction | null) => void
}

const PrimaryActionContext = createContext<PrimaryActionContextValue>({ action: null, setAction: () => {} })

export function PrimaryActionProvider({ children }: { children: React.ReactNode }) {
  const [action, setAction] = useState<PrimaryAction | null>(null)
  return <PrimaryActionContext.Provider value={{ action, setAction }}>{children}</PrimaryActionContext.Provider>
}

/** What the "+ Novo" button in the top bar does on the current screen. */
export function usePrimaryActionValue() {
  return useContext(PrimaryActionContext).action
}

/**
 * Screens call this to claim the top bar's primary button, e.g. `usePrimaryAction("Nova tarefa", openDialog)`.
 * When the screen unmounts the button goes back to opening quick capture.
 */
export function usePrimaryAction(label: string, onClick: () => void) {
  const { setAction } = useContext(PrimaryActionContext)
  const latest = useRef(onClick)

  useEffect(() => {
    latest.current = onClick
  })

  useEffect(() => {
    setAction({ label, onClick: () => latest.current() })
    return () => setAction(null)
  }, [label, setAction])
}
