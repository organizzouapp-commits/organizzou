"use client"

import { useEffect, useState } from "react"

import { useLoadingHandoffActive } from "./loading-handoff"

/** One animated splash per document load: set once any loading logo has been drawn (the hand-off overlay or the first fallback). */
let played = false
export const markSplashPlayed = () => {
  played = true
}

/**
 * Wraps the route-level loading states (root loading.tsx, the app shell's Suspense fallbacks). They must never play the logo intro a second
 * time: while the post-login hand-off overlay owns the screen they render nothing, the first one in a document load animates, and any later
 * one (another boundary resolving after the first) shows the still logotype, which is the animation's resting frame, so nothing restarts.
 */
export function SplashGate({ animated, still }: { animated: React.ReactNode; still: React.ReactNode }) {
  const handoff = useLoadingHandoffActive()
  const [animate] = useState(() => !played)
  useEffect(() => {
    markSplashPlayed()
  }, [])
  if (handoff) return null
  return animate ? animated : still
}
