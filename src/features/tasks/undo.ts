"use client"

import { toast } from "sonner"

/**
 * Undoable destructive actions. The change shows on screen at once (`apply`), the REAL deletion (`commit`) waits until the toast closes
 * without "Desfazer" (8 s, paused while hovered or touched). Undo only has to put the screen back (`revert`): nothing was deleted yet,
 * so a task keeps its checklist, comments, attachments, labels, date and position, a list keeps its tasks and order, and so on.
 * If the page is left before the toast closes, the pending deletions are flushed so they still happen.
 */
export const UNDO_DURATION = 8000

type Pending = { commit: () => Promise<void> }
const pending = new Set<Pending>()
let wired = false

function wire() {
  if (wired || typeof window === "undefined") return
  wired = true
  const flush = () => {
    for (const item of [...pending]) {
      pending.delete(item)
      void item.commit()
    }
  }
  window.addEventListener("pagehide", flush)
}

export function undoable({ message, apply, revert, commit }: { message: string; apply: () => void; revert: () => void; commit: () => Promise<void> }) {
  wire()
  apply()
  let settled = false
  const item: Pending = {
    commit: async () => {
      if (settled) return
      settled = true
      await commit()
    },
  }
  pending.add(item)
  const close = () => {
    if (!pending.delete(item)) return
    void item.commit()
  }
  toast(message, {
    duration: UNDO_DURATION,
    action: {
      label: "Desfazer",
      onClick: () => {
        if (!pending.delete(item)) return
        settled = true
        revert()
      },
    },
    onDismiss: close,
    onAutoClose: close,
  })
}
