"use client"

import { useEffect } from "react"

import { LOGO_INTRO_MS } from "../logo-timing"
import { SPLASH_MAX_MS, splashStep } from "@/lib/splash-machine"
import { splashLog } from "./splash-debug"
import { splash } from "./splash-store"
import { SPLASH_RETURN_COOKIE, SPLASH_START_COOKIE } from "./splash-boot"

const FADE_MS = 400

const clearCookies = () => {
  for (const name of [SPLASH_START_COOKIE, SPLASH_RETURN_COOKIE]) document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
}

/** Called right before the browser leaves for Google: from here on every document that starts within 20 s resumes the same splash. */
export function markSplashStart(at = Date.now()) {
  document.cookie = `${SPLASH_START_COOKIE}=${at}; Max-Age=300; Path=/; SameSite=Lax`
}

/**
 * Takes the server-rendered splash off the screen, once: when the dashboard shell has said it is ready (splash-store) and the intro has had
 * time to finish, or at the hard limit. Then clears the cookies.
 */
export function SplashController() {
  useEffect(() => {
    const root = document.documentElement
    if (!root.hasAttribute("data-splash")) return
    const splashEl = document.getElementById("org-splash")
    if (!splashEl) return
    const began = performance.now()
    const elapsedAtBoot = (parseFloat(getComputedStyle(root).getPropertyValue("--splash-elapsed")) || 0) * 1000
    const reduced = root.hasAttribute("data-splash-final")
    // The wordmark finishes writing itself before the splash leaves (nothing is left to wait for after the intro or with reduced motion).
    const minimum = reduced ? 0 : Math.max(0, LOGO_INTRO_MS - elapsedAtBoot)
    splashLog("controller-mounted", { elapsedAtBoot, minimum, final: reduced })
    let timers: number[] = []
    let finished = false
    const remove = (why: string) => {
      try {
        root.removeAttribute("data-splash")
        root.removeAttribute("data-splash-final")
        root.style.removeProperty("--splash-elapsed")
        splashEl.removeAttribute("data-leaving")
        clearCookies()
        splashLog("splash-removed", { why, afterMs: Math.round(performance.now() - began) })
      } finally {
        splash.markDismissed()
      }
    }
    /** The one way out: idempotent; timers only (no requestAnimationFrame, which pauses in a hidden tab); removed in a finally. */
    const finish = (why: string) => {
      if (finished) return
      finished = true
      try {
        window.clearInterval(poll)
        document.removeEventListener("visibilitychange", tick)
        window.removeEventListener("pageshow", tick)
        splashLog("splash-fade-start", { why, afterMs: Math.round(performance.now() - began) })
        if (document.hidden) return remove(why)
        splashEl.setAttribute("data-leaving", "")
        timers.push(window.setTimeout(() => remove(why), FADE_MS))
      } catch {
        remove(why)
      }
    }
    // This document continues a login that started elapsedAtBoot ago: the same state machine as the hand-off overlay, adopted here.
    splash.markPending({ adopt: true, at: Date.now() - elapsedAtBoot })
    let onTargetSince: number | null = null
    function tick() {
      if (finished) return
      const now = Date.now()
      onTargetSince = window.location.pathname.startsWith("/dashboard") ? (onTargetSince ?? now) : null
      // maxMs counts from pendingAt, which already includes the time before this document started: 6 s in all.
      const step = splashStep({ state: splash.state(), now, minMs: reduced ? 0 : LOGO_INTRO_MS, maxMs: SPLASH_MAX_MS, shellMounted: splash.shellMounted(), onTargetSince, navigatedAt: null, reloaded: true })
      splashLog("due", { due: step })
      if (step === "dismiss") finish(splash.state().phase === "ready" ? "ready" : "pathname-fallback")
      else if (step === "timeout") finish("safety-timeout")
    }
    const poll = window.setInterval(() => {
      try {
        tick()
      } catch {
        finish("error")
      }
    }, 100)
    document.addEventListener("visibilitychange", tick)
    window.addEventListener("pageshow", tick)
    return () => {
      document.removeEventListener("visibilitychange", tick)
      window.removeEventListener("pageshow", tick)
      window.clearInterval(poll)
      timers.forEach((t) => window.clearTimeout(t))
      timers = []
    }
  }, [])
  return null
}
