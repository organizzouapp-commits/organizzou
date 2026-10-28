"use client"

import { useSyncExternalStore } from "react"

import { AnimatedLogo } from "@/components/organizzou/animated-logo"
import { cn } from "@/lib/utils"

import { PRELOADER_EVENT } from "./preloader-boot"

function subscribe(onChange: () => void) {
  window.addEventListener(PRELOADER_EVENT, onChange)
  return () => window.removeEventListener(PRELOADER_EVENT, onChange)
}

/** The entrance logo waits for the preloader to leave, so its intro is seen instead of playing behind the overlay. */
export function SiteHeroLogo({ className }: { className?: string }) {
  const ready = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.preloader !== "show",
    () => false
  )
  // The box is always there (fixed height), so nothing shifts when the image appears.
  return (
    <span className={cn("inline-flex", className)}>
      {ready ? <AnimatedLogo variant="entrance" size="lg" inverse /> : null}
    </span>
  )
}
