"use client"

import { createContext, useContext } from "react"

import { DEFAULT_PREFS, type TodayPrefs } from "@/features/today/prefs"

type PrefsApi = {
  prefs: TodayPrefs
  /** Applies a change to the preferences: optimistic, saved after a short pause, rolled back if the save fails. */
  update: (change: (current: TodayPrefs) => TodayPrefs) => void
}

const PrefsContext = createContext<PrefsApi>({ prefs: DEFAULT_PREFS, update: () => {} })

export const PrefsProvider = PrefsContext.Provider

/** The person's layout preferences, for widgets that remember something (which panel is open, which group is folded). */
export function useTodayPrefs() {
  return useContext(PrefsContext)
}
