"use client"

import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { SPLASH_MAX_MS, splashStep } from "@/lib/splash-machine"
import { cn } from "@/lib/utils"

import { LOGO_INTRO_MS, LOGO_REDUCED_MOTION_MS } from "./logo-timing"
import { LoadingScreenView } from "./loading-screen"
import { markSplashPlayed } from "./splash-gate"
import { markSplashStart } from "./splash/splash-controller"
import { splashLog } from "./splash/splash-debug"
import { splash } from "./splash/splash-store"

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
  const pathname = usePathname()
  const routerRef = useRef(router)
  const tickRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    routerRef.current = router
  })
  // prefers-reduced-motion: the still logotype, no animation at all.
  const reducedMotion = useSyncExternalStore(subscribeReduced, reducedNow, () => false)
  const [fading, setFading] = useState(false)
  const host = useRef<HTMLDivElement>(null)

  // Every route commit is also a moment to decide (no waiting for the next poll).
  useEffect(() => {
    tickRef.current?.()
  }, [pathname])

  useEffect(() => {
    if (!active) return
    const timers: number[] = []
    let poll = 0
    let done = false
    let navigatedAt: number | null = null
    let onTargetSince: number | null = null
    let reloaded = false
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const introMs = reduced ? LOGO_REDUCED_MOTION_MS : LOGO_INTRO_MS
    const began = Date.now()
    const target = href ? new URL(href, window.location.origin) : null
    const startUrl = window.location.href
    splashLog("handoff-start", { href, introMs })

    const stopWatching = () => {
      window.clearInterval(poll)
      document.removeEventListener("visibilitychange", tick)
      window.removeEventListener("pageshow", tick)
      tickRef.current = null
    }
    const remove = (why: string) => {
      try {
        splash.markDismissed()
        splashLog("handoff-removed", { reason: why, afterMs: Date.now() - began })
      } finally {
        // Whatever happened above, the overlay goes.
        setState({ active: false, href: null })
        setFading(false)
      }
    }
    /** The ONE way out: idempotent, callable from the poll, the pathname effect, visibilitychange/pageshow and the hard limit; the overlay is removed in a finally. */
    const dismiss = (why: string) => {
      if (done) return
      done = true
      try {
        stopWatching()
        splashLog("handoff-fade", { why, afterMs: Date.now() - began })
        // A hidden tab never runs transitions: no fade there. Timers (not requestAnimationFrame, which pauses) drive everything.
        if (document.hidden) return remove(why)
        setFading(true)
        timers.push(window.setTimeout(() => remove(why), FADE_MS))
      } catch {
        remove(why)
      }
    }

    // The client navigation (replace, so Back does not return to the login), then a refresh so the server components read the new cookies.
    const navigate = () => {
      if (done || !target) return
      navigatedAt = Date.now()
      splashLog("router-replace-called", { to: target.pathname })
      routerRef.current.replace(`${target.pathname}${target.search}`)
    }

    function tick() {
      if (done) return
      const now = Date.now()
      const here = window.location
      const onTarget = target !== null && (here.pathname === target.pathname || here.pathname.startsWith(`${target.pathname}/`))
      onTargetSince = onTarget ? (onTargetSince ?? now) : null
      // The dashboard sent a signed-in person back to the login (a bounce with ?next=): say so instead of spinning.
      if (target && navigatedAt !== null && here.pathname.startsWith("/login") && here.href !== startUrl && now - navigatedAt > 1200) {
        splashLog("bounced-to-login", { url: here.href })
        toast.error("Não foi possível abrir o painel. Entre de novo.")
        return dismiss("bounced")
      }
      const step = splashStep({
        state: splash.state(),
        now,
        minMs: introMs,
        maxMs: target ? SPLASH_MAX_MS : NO_TARGET_MS,
        shellMounted: splash.shellMounted(),
        onTargetSince,
        navigatedAt,
        reloaded,
      })
      if (step === "dismiss") return dismiss(splash.state().phase === "ready" ? "ready-signal" : "pathname-fallback")
      if (step === "timeout") return dismiss("timeout")
      if (step === "reload" && target) {
        // What F5 does: a full page load, which continues this same splash from the cookie (the server renders it).
        reloaded = true
        splashLog("hard-navigation", { to: target.href, onTarget: onTargetSince !== null })
        markSplashStart(began)
        window.location.assign(target.href)
      }
    }
    tickRef.current = tick
    poll = window.setInterval(() => {
      try {
        tick()
      } catch {
        dismiss("error")
      }
    }, 100)
    document.addEventListener("visibilitychange", tick)
    window.addEventListener("pageshow", tick)

    // The navigation starts AT ONCE, under the opaque overlay, in parallel with the intro.
    if (target) timers.push(window.setTimeout(navigate, 0))
    // A shell that was already there (cached / fast dashboard) is handled by the first tick as well.
    timers.push(window.setTimeout(tick, 0))

    return () => {
      done = true
      stopWatching()
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [active, href])

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
