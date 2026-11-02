"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { toast } from "sonner"

import { logWater, saveMood } from "@/features/today/actions"

/**
 * What the person did on this page since it loaded: ticks, quantities, postponed items, water, mood. The widgets arrive from the
 * server with their initial numbers; this layer is what keeps the cards, the timeline and the panels in step with each other
 * ("2 de 5 concluídas" changes the moment a task is ticked). Each change is also saved (tasks, habits, water, mood).
 */
type TodayState = {
  /** Item id -> done. Only ids the person touched; everything else keeps the server's value. */
  done: Record<string, boolean>
  /** Item id -> when it was ticked on this page (ms), so "Concluídos" can list the most recent first. */
  doneAt: Record<string, number>
  /** Habit id -> logged quantity today (goal habits). */
  qty: Record<string, number>
  postponed: Set<string>
  /** Water added on this page, in ml, on top of the server's number. */
  waterMl: number
  mood: number | null
}

type TodayApi = TodayState & {
  setDone: (id: string, done: boolean) => void
  setQty: (id: string, qty: number) => void
  postpone: (id: string, postponed: boolean) => void
  addWater: (ml: number) => void
  setMood: (value: number) => void
}

const Context = createContext<TodayApi | null>(null)

export function TodayStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TodayState>({ done: {}, doneAt: {}, qty: {}, postponed: new Set(), waterMl: 0, mood: null })

  const setDone = useCallback(
    (id: string, done: boolean) =>
      setState((s) => {
        const doneAt = { ...s.doneAt }
        if (done) doneAt[id] = Date.now()
        else delete doneAt[id]
        return { ...s, done: { ...s.done, [id]: done }, doneAt }
      }),
    []
  )
  const setQty = useCallback((id: string, qty: number) => setState((s) => ({ ...s, qty: { ...s.qty, [id]: qty } })), [])
  const postpone = useCallback(
    (id: string, postponed: boolean) =>
      setState((s) => {
        const next = new Set(s.postponed)
        if (postponed) next.add(id)
        else next.delete(id)
        return { ...s, postponed: next }
      }),
    []
  )
  // Water and mood show at once and are saved; if the database refuses, the change is undone and the person is told.
  const addWater = useCallback((ml: number) => {
    setState((s) => ({ ...s, waterMl: s.waterMl + ml }))
    void logWater({ ml }).then((result) => {
      if (result.ok) return
      setState((s) => ({ ...s, waterMl: Math.max(0, s.waterMl - ml) }))
      toast.error("Não consegui registrar a água. A alteração foi desfeita.")
    })
  }, [])
  const setMood = useCallback((mood: number) => {
    let before: number | null = null
    setState((s) => {
      before = s.mood
      return { ...s, mood }
    })
    void saveMood({ mood }).then((result) => {
      if (result.ok) return
      setState((s) => ({ ...s, mood: before }))
      toast.error("Não consegui registrar o humor. A alteração foi desfeita.")
    })
  }, [])

  const value = useMemo(() => ({ ...state, setDone, setQty, postpone, addWater, setMood }), [state, setDone, setQty, postpone, addWater, setMood])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

/** Falls back to an inert state when a widget is rendered outside the page (stories, tests): no crash, no overrides. */
const INERT: TodayApi = {
  done: {},
  doneAt: {},
  qty: {},
  postponed: new Set(),
  waterMl: 0,
  mood: null,
  setDone: () => {},
  setQty: () => {},
  postpone: () => {},
  addWater: () => {},
  setMood: () => {},
}

export function useTodayState() {
  return useContext(Context) ?? INERT
}
