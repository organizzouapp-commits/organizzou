"use client"

import { useEffect } from "react"

import { LOGO_INTRO_MS } from "../logo-timing"
import { splashDue } from "@/lib/splash-machine"
import { splashLog } from "./splash-debug"
import { splash } from "./splash-store"
import { SPLASH_RETURN_COOKIE, SPLASH_START_COOKIE } from "./splash-boot"

const SAFETY_MS = 8_000 // the hard limit: after this the page that is there is shown, ready or not
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
    const finish = (why: string) => {
      if (finished) return
      finished = true
      window.clearInterval(poll)
      splashLog("splash-fade-start", { why, afterMs: Math.round(performance.now() - began) })
      // Two frames, so the content is on screen before the fade starts.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          splash.markDismissed()
          splashEl.setAttribute("data-leaving", "")
          timers.push(
            window.setTimeout(() => {
              root.removeAttribute("data-splash")
              root.removeAttribute("data-splash-final")
              root.style.removeProperty("--splash-elapsed")
              splashEl.removeAttribute("data-leaving")
              clearCookies()
              splashLog("splash-removed", { afterMs: Math.round(performance.now() - began) })
            }, FADE_MS)
          )
        })
      )
    }
    // This document continues a login that started elapsedAtBoot ago: the same state machine as the hand-off overlay, adopted here.
    splash.markPending({ adopt: true, at: Date.now() - elapsedAtBoot })
    const poll = window.setInterval(() => {
      const due = splashDue(splash.state(), Date.now(), { minMs: reduced ? 0 : LOGO_INTRO_MS, maxMs: SAFETY_MS + elapsedAtBoot })
      splashLog("due", { due })
      if (due === "dismiss") finish("ready")
      else if (due === "timeout") {
        // Same rule as the hand-off overlay: the hard limit never reveals a bare wallpaper, so hold (up to 20 s in all) until the shell is there.
        if (splash.state().phase === "ready") finish("ready")
        else if (!splash.shellMounted() && performance.now() - began < 20_000) return
        else finish("safety-timeout")
      }
    }, 100)
    return () => {
      window.clearInterval(poll)
      timers.forEach((t) => window.clearTimeout(t))
      timers = []
    }
  }, [])
  return null
}
