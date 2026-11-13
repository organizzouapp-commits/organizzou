"use client"

import { useEffect } from "react"

/** Registers the service worker (web push) in production only; in development a worker would hide changes behind stale files. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Without a worker the app works as before; only push is unavailable.
    })
  }, [])
  return null
}
