"use client"

import { useCallback, useSyncExternalStore } from "react"

import type { CalendarViewId } from "@/components/calendar/agenda-screen"

/**
 * Per-person calendar preferences, kept on this device (localStorage) until a preferences column exists: the last mode, which lists are
 * hidden, "Mostrar concluídas" and which collapsible groups the person opened or closed. A tiny external store so the header card's mode
 * switcher, the "Filtrar e ordenar" sheet and the calendar itself always agree.
 */
export type CalendarPrefs = { view: CalendarViewId | null; showDone: boolean; hiddenLists: string[]; /** Explicit open (true) / closed (false) choices of the collapsible groups. */ open: Record<string, boolean> }

const STORAGE_KEY = "organizzou:tarefas-calendar-v2"
export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = { view: null, showDone: true, hiddenLists: [], open: {} }
const MODES = ["mes", "semana", "dia", "agenda"]

function parse(raw: string | null): CalendarPrefs {
  if (!raw) return DEFAULT_CALENDAR_PREFS
  try {
    const data = JSON.parse(raw) as Partial<CalendarPrefs>
    return {
      view: data.view && MODES.includes(data.view) ? data.view : null,
      showDone: data.showDone !== false,
      hiddenLists: Array.isArray(data.hiddenLists) ? data.hiddenLists.filter((id): id is string => typeof id === "string") : [],
      open: data.open && typeof data.open === "object" ? data.open : {},
    }
  } catch {
    return DEFAULT_CALENDAR_PREFS
  }
}

let cache: { raw: string | null; value: CalendarPrefs } | null = null
/** Private mode (no localStorage): the choices live in memory for this visit. */
let memory: CalendarPrefs | null = null
const listeners = new Set<() => void>()

function snapshot(): CalendarPrefs {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return memory ?? DEFAULT_CALENDAR_PREFS
  }
  if (!cache || cache.raw !== raw) cache = { raw, value: parse(raw) }
  return cache.value
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => event.key === STORAGE_KEY && listener()
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function updateCalendarPrefs(change: (current: CalendarPrefs) => CalendarPrefs) {
  const next = change(snapshot())
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    memory = next
  }
  for (const listener of listeners) listener()
}

export function useCalendarPrefs() {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_CALENDAR_PREFS)
  const update = useCallback((change: (current: CalendarPrefs) => CalendarPrefs) => updateCalendarPrefs(change), [])
  return { prefs, update }
}

/** The mode in use: the saved one, else Semana on phones and Mês on desktop. */
export const resolveMode = (prefs: CalendarPrefs, isMobile: boolean): CalendarViewId => prefs.view ?? (isMobile ? "semana" : "mes")
