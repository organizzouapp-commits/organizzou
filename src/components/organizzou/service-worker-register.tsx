"use client"

import { useEffect } from "react"
import { toast } from "sonner"

/**
 * Registers the service worker (web push, and the shell of the installed app) in production only; in development a worker would hide changes
 * behind stale files. When a new version is waiting a toast offers "Atualizar" (skip waiting, then reload), and the app checks for a new
 * version whenever it comes back into focus.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    let reloading = false
    let shown = false
    const offer = (worker: ServiceWorker) => {
      if (shown) return
      shown = true
      toast("Nova versão disponível", {
        duration: Infinity,
        action: { label: "Atualizar", onClick: () => worker.postMessage({ type: "SKIP_WAITING" }) },
      })
    }
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

    let registration: ServiceWorkerRegistration | null = null
    const watch = (reg: ServiceWorkerRegistration) => {
      // A worker already waiting when the page opens, or one that finishes installing later (only when an older one controls the page).
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting)
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) offer(installing)
        })
      })
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg
        watch(reg)
      })
      .catch(() => {
        // Without a worker the app works as before; only push and updates are unavailable.
      })

    const check = () => document.visibilityState === "visible" && registration?.update().catch(() => undefined)
    document.addEventListener("visibilitychange", check)
    window.addEventListener("focus", check)
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
      document.removeEventListener("visibilitychange", check)
      window.removeEventListener("focus", check)
    }
  }, [])
  return null
}
