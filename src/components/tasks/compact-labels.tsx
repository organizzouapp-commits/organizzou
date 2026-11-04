"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

/**
 * "Compact labels": clicking any label chip on a card turns every chip into its 10px dot (and back). One global choice per person,
 * kept on this device (localStorage) until a preferences column exists.
 */
const STORAGE_KEY = "organizzou:tarefas-compact-labels"

type CompactLabels = { compact: boolean; toggle: () => void }
const CompactLabelsContext = createContext<CompactLabels>({ compact: false, toggle: () => {} })

export const CompactLabelsProvider = CompactLabelsContext.Provider
export const useCompactLabels = () => useContext(CompactLabelsContext)

export function useCompactLabelsStore(): CompactLabels {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    try {
      // localStorage only exists in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompact(window.localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      // Private mode: stays expanded.
    }
  }, [])
  const toggle = useCallback(() => {
    setCompact((current) => {
      const next = !current
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      } catch {
        // Private mode: the choice just does not survive the visit.
      }
      return next
    })
  }, [])
  return useMemo(() => ({ compact, toggle }), [compact, toggle])
}
