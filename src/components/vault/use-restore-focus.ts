"use client"

import { useEffect, useRef } from "react"

const INSIDE_OVERLAY = "[role=dialog],[role=alertdialog],[data-vaul-drawer],[data-radix-popper-content-wrapper]"

/**
 * Gives focus back to what had it before a dialog or sheet opened, once it closes. The dialogs here open from state (not from a Radix trigger),
 * and Radix only restores focus to a trigger, so without this focus falls to the page and keyboard users lose their place.
 */
export function useRestoreFocus(open: boolean) {
  const last = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      if (target && !target.closest(INSIDE_OVERLAY)) last.current = target
    }
    document.addEventListener("focusin", onFocusIn)
    return () => document.removeEventListener("focusin", onFocusIn)
  }, [])

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    const element = last.current
    const id = window.setTimeout(() => {
      if (element?.isConnected) element.focus({ preventScroll: true })
    }, 50)
    return () => window.clearTimeout(id)
  }, [open])
}
