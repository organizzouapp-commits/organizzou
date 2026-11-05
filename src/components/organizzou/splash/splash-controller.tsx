"use client"

import { useEffect } from "react"

import { LOGO_INTRO_MS } from "../logo-timing"
import { splashLog } from "./splash-debug"
import { SPLASH_RETURN_COOKIE, SPLASH_START_COOKIE } from "./splash-boot"

const SAFETY_MS = 45_000
const FADE_MS = 400

const clearCookies = () => {
  for (const name of [SPLASH_START_COOKIE, SPLASH_RETURN_COOKIE]) document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
}

/** Called right before the browser leaves for Google: from here on every document that starts within 20 s resumes the same splash. */
export function markSplashStart() {
  document.cookie = `${SPLASH_START_COOKIE}=${Date.now()}; Max-Age=300; Path=/; SameSite=Lax`
}

/**
 * Takes the server-rendered splash off the screen, once: when the dashboard has real content painted (the shell is there, no skeleton or
 * loader is still showing, the page has text) and the intro has had time to finish, or after the safety timeout. Then clears the cookies.
 */
export function SplashController() {
  useEffect(() => {
    const root = document.documentElement
    if (!root.hasAttribute("data-splash")) return
    const splash = document.getElementById("org-splash")
    if (!splash) return
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
          splash.setAttribute("data-leaving", "")
          timers.push(
            window.setTimeout(() => {
              root.removeAttribute("data-splash")
              root.removeAttribute("data-splash-final")
              root.style.removeProperty("--splash-elapsed")
              splash.removeAttribute("data-leaving")
              clearCookies()
              splashLog("splash-removed", { afterMs: Math.round(performance.now() - began) })
            }, FADE_MS)
          )
        })
      )
    }
    const poll = window.setInterval(() => {
      const now = performance.now() - began
      const shell = document.querySelector("[data-app-scroll]")
      // Fallback loaders are hidden by CSS while the splash is on, but if one is still mounted the page is not ready.
      const loading = Boolean(shell?.querySelector(".page-skeleton, [aria-busy=true]")) || Boolean(document.querySelector("[data-fallback-splash]"))
      const painted = Boolean(shell) && !loading && (shell?.textContent?.trim().length ?? 0) > 20
      if (painted && now >= minimum) finish("painted")
      else if (now >= SAFETY_MS) finish("safety-timeout")
    }, 100)
    return () => {
      window.clearInterval(poll)
      timers.forEach((t) => window.clearTimeout(t))
      timers = []
    }
  }, [])
  return null
}
