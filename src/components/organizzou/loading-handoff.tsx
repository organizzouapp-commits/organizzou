"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"

import { LoadingScreen } from "./loading-screen"
import { cn } from "@/lib/utils"

const MIN_MS = 3000 // the wordmark needs ~2.6 s to finish writing, plus the time the SVG takes to load
const MAX_MS = 5000
const FADE_MS = 400

let active = false
let startedAt = 0
const listeners = new Set<() => void>()
function setActive(value: boolean) {
  active = value
  if (value) startedAt = performance.now()
  listeners.forEach((l) => l())
}

/** Show the full-screen loading logotype now (after a successful login, before navigating). The overlay outlives the route change. */
export function startLoadingHandoff() {
  setActive(true)
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

/**
 * Mounted once in the root layout, so it survives the /login -> /dashboard navigation without restarting the animation.
 * It leaves when the dashboard shell is on screen and the logo has had its ~2.6 s (never later than 5 s), with a 0.4 s fade.
 */
export function LoadingHandoff() {
  const on = useSyncExternalStore(subscribe, () => active, () => false)
  const pathname = usePathname()
  const [fading, setFading] = useState(false)
  // The overlay may only leave once the dashboard is the current route.
  const arrived = useRef(false)
  useEffect(() => {
    arrived.current = pathname.startsWith("/dashboard")
  }, [pathname])

  useEffect(() => {
    if (!on) return
    let finish = 0
    let gone = 0
    const leave = () => {
      setFading(true)
      gone = window.setTimeout(() => {
        setActive(false)
        setFading(false)
      }, FADE_MS)
    }
    const poll = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      const ready = arrived.current && document.querySelector("[data-app-scroll]")
      if (elapsed >= MAX_MS || (ready && elapsed >= MIN_MS)) {
        window.clearInterval(poll)
        finish = window.setTimeout(leave, 0)
      }
    }, 100)
    return () => {
      window.clearInterval(poll)
      window.clearTimeout(finish)
      window.clearTimeout(gone)
    }
  }, [on])

  if (!on) return null
  return (
    <div
      className={cn(
        "fixed inset-0 z-[110] transition-opacity duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      )}
    >
      <LoadingScreen className="z-auto" />
    </div>
  )
}
