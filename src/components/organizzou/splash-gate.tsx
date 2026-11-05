"use client"

import { useEffect, useState } from "react"

import { useLoadingHandoffActive } from "./loading-handoff"

/** One animated splash per document load: set once any loading logo has been drawn (the hand-off overlay or the first fallback). */
let played = false
const KEY = "organizzou:splash-at"
/** A splash that started within this long ago counts as "just played" even across full page loads (Google sign-in, auth callback). */
const RECENT_MS = 15_000
export const markSplashPlayed = () => {
  played = true
  try {
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Private mode: the module flag still covers this document.
  }
}
const playedRecently = () => {
  try {
    return Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < RECENT_MS
  } catch {
    return false
  }
}

/**
 * Wraps the route-level loading states (root loading.tsx, the app shell's Suspense fallbacks). They must never play the logo intro a second
 * time: while the post-login hand-off overlay owns the screen they render nothing, the first one in a document load animates, and any later
 * one (another boundary resolving after the first) shows the still logotype, which is the animation's resting frame, so nothing restarts.
 */
export function SplashGate({ animated, still }: { animated: React.ReactNode; still: React.ReactNode }) {
  const handoff = useLoadingHandoffActive()
  const [animate, setAnimate] = useState(() => !played)
  const [recent, setRecent] = useState(false)
  useEffect(() => {
    // Read after mount so the server HTML and the first client render agree; a splash drawn right after another one turns into the still logo.
    const again = playedRecently()
    if (again) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent(true)
      setAnimate(false)
    } else markSplashPlayed()
  }, [])
  if (handoff) return null
  return animate && !recent ? animated : still
}
