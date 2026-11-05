"use client"

import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { shouldHardNavigate, splashDue } from "@/lib/splash-machine"
import { cn } from "@/lib/utils"

import { LOGO_INTRO_MS, LOGO_REDUCED_MOTION_MS } from "./logo-timing"
import { LoadingScreenView } from "./loading-screen"
import { markSplashPlayed } from "./splash-gate"
import { markSplashStart } from "./splash/splash-controller"
import { splashLog } from "./splash/splash-debug"
import { splash } from "./splash/splash-store"

/** The hard limit, counted from the start of the hand-off: after it the overlay fades out whatever the page is doing (the page that is there is shown). */
const MAX_MS = 8000
const EXTENDED_MS = 20000 // only while the dashboard route has committed but its shell has not mounted yet
const NO_TARGET_MS = 8000 // Google sign-in leaves the page by itself; this only guards a failed redirect
const FADE_MS = 400

type State = { active: boolean; href: string | null }
let state: State = { active: false, href: null }
const listeners = new Set<() => void>()
function setState(next: State) {
  state = next
  listeners.forEach((l) => l())
}

/**
 * Show the full-screen loading logotype after a successful login. With an href the overlay owns the navigation: it prefetches the
 * destination at once, navigates immediately (under the opaque overlay) and leaves when the dashboard shell says it is ready (splash-store) and
 * the logo's intro has played, or at the hard limit. Without an href (Google leaves the page itself) it just covers the screen.
 */
export function startLoadingHandoff(href?: string) {
  markSplashPlayed()
  splash.markPending()
  setState({ active: true, href: href ?? null })
}

/** A sign-in that failed after all: the overlay goes away at once (no fade, nothing to wait for). */
export function stopLoadingHandoff() {
  if (!state.active) return
  splash.markDismissed()
  setState({ active: false, href: null })
}

// Test hook (never in production builds): lets Playwright start the hand-off without a real sign-in.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  ;(window as unknown as { __startLoadingHandoff: typeof startLoadingHandoff }).__startLoadingHandoff = startLoadingHandoff
}

/** True while the hand-off overlay owns the screen: every other loading state stays out of its way. */
export function useLoadingHandoffActive() {
  return useSyncExternalStore(
    subscribe,
    () => state.active,
    () => false
  )
}

const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

/** The logo never re-renders while it plays: this subtree has no props and no state. */
const Logo = memo(function Logo({ still }: { still: boolean }) {
  return <LoadingScreenView className="z-auto" still={still} fallback={false} />
})

/** Mounted once in the root layout, so it survives the /login -> /dashboard navigation without restarting the animation. */
export function LoadingHandoff() {
  const { active, href } = useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  )
  const router = useRouter()
  // prefers-reduced-motion: the still logotype, no animation at all.
  const reducedMotion = useSyncExternalStore(subscribeReduced, reducedNow, () => false)
  const [fading, setFading] = useState(false)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const timers: number[] = []
    let poll = 0
    let cancelled = false
    let navigatedAt: number | null = null
    let hardNavigated = false
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const introMs = reduced ? LOGO_REDUCED_MOTION_MS : LOGO_INTRO_MS
    const began = Date.now()
    const target = href ? new URL(href, window.location.origin) : null
    const startUrl = window.location.href
    splashLog("handoff-start", { href, introMs })

    let reason = ""
    const finish = (why: string) => {
      if (cancelled) return
      reason = why
      window.clearInterval(poll)
      splashLog("handoff-fade", { why, afterMs: Date.now() - began })
      // Two frames, so what is behind is on the screen before the overlay starts to fade.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (cancelled) return
          setFading(true)
          timers.push(
            window.setTimeout(() => {
              splash.markDismissed()
              setState({ active: false, href: null })
              setFading(false)
              splashLog("handoff-removed", { reason, afterMs: Date.now() - began })
            }, FADE_MS)
          )
        })
      )
    }

    // The client navigation (replace, so Back does not return to the login), then a refresh so the server components read the new cookies.
    const navigate = () => {
      if (cancelled || !target) return
      navigatedAt = Date.now()
      splashLog("router-replace-called", { to: target.pathname })
      router.replace(`${target.pathname}${target.search}`)
      router.refresh()
    }

    poll = window.setInterval(() => {
      const now = Date.now()
      const due = splashDue(splash.state(), now, { minMs: introMs, maxMs: target ? MAX_MS : NO_TARGET_MS })
      if (due === "dismiss") return finish("ready-signal")
      if (due === "timeout") {
        // The hard limit shows the page that is there, but never a bare wallpaper: if the dashboard route has committed and its shell is still not
        // mounted, hold a little longer (up to EXTENDED_MS in all) instead of revealing nothing.
        const onTarget = target !== null && window.location.pathname.startsWith(target.pathname)
        if (splash.state().phase === "ready") return finish("ready-signal")
        if (onTarget && !splash.shellMounted() && now - began < EXTENDED_MS) return
        return finish("timeout")
      }
      if (target && navigatedAt !== null) {
        const here = window.location
        // The dashboard sent a signed-in person back to the login (a bounce with ?next=): say so instead of spinning.
        if (here.pathname.startsWith("/login") && here.href !== startUrl && now - navigatedAt > 1200) {
          splashLog("bounced-to-login", { url: here.href })
          toast.error("Não foi possível abrir o painel. Entre de novo.")
          splash.markDismissed()
          setState({ active: false, href: null })
          return
        }
        // The client navigation went nowhere: do it for real (a full page load, which is how the Google flow arrives).
        if (!hardNavigated && shouldHardNavigate(now, navigatedAt, here.pathname, target.pathname)) {
          hardNavigated = true
          splashLog("hard-navigation", { to: target.href })
          // A full page load is a new document: leave the start time (like the Google flow) so it continues this splash instead of starting another.
          markSplashStart(began)
          window.location.assign(target.href)
        }
      }
    }, 100)

    // The navigation starts AT ONCE, under the opaque overlay, in parallel with the intro (it used to wait for the intro, which added the whole
    // intro to the time to the dashboard). The overlay still stays until the intro has played AND the shell has said it is ready.
    if (target) timers.push(window.setTimeout(navigate, 0))

    return () => {
      cancelled = true
      window.clearInterval(poll)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [active, href, router])

  if (!active) return null
  return (
    <div
      ref={host}
      data-handoff
      className={cn(
        "fixed inset-0 z-[110] transition-opacity duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      )}
    >
      <Logo still={reducedMotion} />
    </div>
  )
}
