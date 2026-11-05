"use client"

import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"

import { LOGO_INTRO_MS, LOGO_REDUCED_MOTION_MS } from "./logo-timing"
import { LoadingScreenView } from "./loading-screen"
import { markSplashPlayed } from "./splash-gate"

const ARRIVE_MAX_MS = 45000 // after navigating: a very slow connection keeps the splash rather than showing the bare wallpaper or a second loader; only a navigation that never arrives gives up
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
 * Show the full-screen loading logotype after a successful login. With an href the overlay owns the navigation: it prefetches
 * the destination at once, but only navigates when the logo's intro has fully played (measured from the moment the animation
 * starts), then fades out once the destination is on screen. Without an href (Google leaves the page itself) it just covers
 * the screen.
 */
export function startLoadingHandoff(href?: string) {
  markSplashPlayed()
  setState({ active: true, href: href ?? null })
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
  return <LoadingScreenView className="z-auto" still={still} />
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
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const introMs = reduced ? LOGO_REDUCED_MOTION_MS : LOGO_INTRO_MS

    const finish = () => {
      if (cancelled) return
      setFading(true)
      timers.push(
        window.setTimeout(() => {
          setState({ active: false, href: null })
          setFading(false)
        }, FADE_MS)
      )
    }

    const navigate = () => {
      if (cancelled || !href) return
      router.push(href)
      const target = new URL(href, window.location.origin).pathname
      const began = performance.now()
      poll = window.setInterval(() => {
        const shell = document.querySelector("[data-app-scroll]")
        // Ready = on the dashboard, the shell is there, no skeleton or loader is still on screen and the page has content: the wallpaper alone
        // is never what shows when the overlay leaves.
        const painted = window.location.pathname === target && Boolean(shell) && !shell?.querySelector(".page-skeleton, [aria-busy=true]") && (shell?.textContent?.trim().length ?? 0) > 20 && !document.querySelector("[role=status][aria-label=Carregando]:not([data-handoff] *)")
        if (painted || performance.now() - began >= ARRIVE_MAX_MS) {
          window.clearInterval(poll)
          // Two frames, so the content is on the screen before the overlay starts to fade.
          requestAnimationFrame(() => requestAnimationFrame(finish))
        }
      }, 100)
    }

    // The intro clock starts when the animated SVG is actually painted (its load), not when the button was clicked.
    const start = (animationStart: number) => {
      if (!href) {
        timers.push(window.setTimeout(finish, NO_TARGET_MS))
        return
      }
      timers.push(window.setTimeout(navigate, Math.max(0, animationStart + introMs - performance.now())))
    }

    if (href) router.prefetch(href)
    const visible = Array.from(host.current?.querySelectorAll("img") ?? []).find((img) => getComputedStyle(img).display !== "none")
    if (!visible || visible.complete) start(performance.now())
    else visible.addEventListener("load", () => start(performance.now()), { once: true })

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
