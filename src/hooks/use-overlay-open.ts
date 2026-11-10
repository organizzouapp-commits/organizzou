"use client"

import { useEffect, useState } from "react"

const OPEN_OVERLAY = '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[data-vaul-drawer][data-state="open"]'

/** True while any dialog, alert dialog or bottom sheet is open anywhere in the page (Radix and vaul mark them with data-state="open"). */
export function useOverlayOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let frame = 0
    const check = () => {
      frame = 0
      setOpen(document.querySelector(OPEN_OVERLAY) !== null)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state"] })
    schedule()
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return open
}
