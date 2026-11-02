"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"


import { persistRows, type PersistResult } from "./actions"
import { columnsOf, TABLES, type TableName } from "./registry"

const SAVE_ERROR = "Não consegui salvar. A alteração foi desfeita"

/** Saves run one after another, in the order the person made the changes: a habit exists before its first log is written. */
let queue: Promise<unknown> = Promise.resolve()
function enqueue(task: () => Promise<PersistResult>) {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

const same = (a: Record<string, unknown>, b: Record<string, unknown>, columns: string[]) => columns.every((c) => JSON.stringify(a[c]) === JSON.stringify(b[c]))

type Options = {
  /** Wait this long after the last change before saving (typing in a note); the change shows at once either way. */
  debounceMs?: number
}

/**
 * `useState` for the rows of one table, but every change is saved. Use it exactly like `useState<T[]>(initial)`:
 *   - the screen updates at once (optimistic);
 *   - what changed (rows added, edited, removed) is sent to the server, validated and saved, in order;
 *   - if the save fails the change is undone and an honest toast says why;
 *   - on reload the rows come back from the database (the page passes them as `initial`).
 */
export function usePersistedRows<T extends { id: string }>(table: TableName, initial: T[] | (() => T[]), options: Options = {}) {
  const [rows, setState] = useState<T[]>(initial)
  const current = useRef(rows)
  /** The rows as the server has them, or is about to have them. The next save sends only the difference. */
  const sent = useRef(rows)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const debounceMs = options.debounceMs ?? 0

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const before = sent.current
    const after = current.current
    if (before === after) return
    const columns = columnsOf(table)
    const old = new Map(before.map((row) => [row.id, row]))
    const now = new Set(after.map((row) => row.id))
    const upserts = after.filter((row) => {
      const was = old.get(row.id)
      return !was || !same(was as Record<string, unknown>, row as Record<string, unknown>, columns)
    })
    const deletes = before.filter((row) => !now.has(row.id)).map((row) => row.id)
    sent.current = after
    if (upserts.length === 0 && deletes.length === 0) return

    const pick = (row: T) => Object.fromEntries([...Object.keys(TABLES[table].columns), "id"].map((c) => [c, (row as Record<string, unknown>)[c]]))
    void enqueue(() => persistRows({ table, upserts: upserts.map(pick), deletes })).then((result) => {
      if (result.ok) return
      // Undo only what this save touched, so a later change that did succeed stays.
      const touched = new Set([...upserts.map((r) => r.id), ...deletes])
      const undo = (list: T[]) => {
        const kept = list.filter((row) => !touched.has(row.id) || old.has(row.id)).map((row) => (touched.has(row.id) && old.has(row.id) ? old.get(row.id)! : row))
        const back = [...touched].flatMap((id) => (old.has(id) && !kept.some((row) => row.id === id) ? [old.get(id)!] : []))
        return [...kept, ...back]
      }
      current.current = undo(current.current)
      sent.current = undo(sent.current)
      setState(current.current)
      toast.error(`${SAVE_ERROR}. ${result.error}`)
    })
  }, [table])

  const setRows = useCallback(
    (update: T[] | ((previous: T[]) => T[])) => {
      const next = typeof update === "function" ? update(current.current) : update
      if (next === current.current) return
      current.current = next
      setState(next)
      if (debounceMs === 0) flush()
      else {
        clearTimeout(timer.current)
        timer.current = setTimeout(flush, debounceMs)
      }
    },
    [debounceMs, flush]
  )

  // Leaving the screen (or the tab) must not lose a change that is still waiting for its pause.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush()
    document.addEventListener("visibilitychange", onHide)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      flush()
    }
  }, [flush])

  return [rows, setRows] as const
}

/**
 * Same idea for the tables that hold ONE row per person (diet goals, notification preferences): `[value, setValue]`.
 */
export function usePersistedValue<T extends Record<string, unknown>>(table: TableName, initial: T) {
  const [value, setState] = useState<T>(initial)
  const current = useRef(value)

  const setValue = useCallback(
    (update: T | ((previous: T) => T)) => {
      const previous = current.current
      const next = typeof update === "function" ? update(previous) : update
      if (next === previous) return
      current.current = next
      setState(next)
      const row = Object.fromEntries(Object.keys(TABLES[table].columns).map((c) => [c, next[c]]))
      void enqueue(() => persistRows({ table, upserts: [row], deletes: [] })).then((result) => {
        if (result.ok) return
        current.current = previous
        setState(previous)
        toast.error(`${SAVE_ERROR}. ${result.error}`)
      })
    },
    [table]
  )
  return [value, setValue] as const
}
