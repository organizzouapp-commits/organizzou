"use client"

import { useEffect, useState } from "react"

import { LoadingScreen } from "@/components/organizzou/loading-screen"

import { PRELOADER_EVENT, PRELOADER_KEY } from "./preloader-boot"

const MIN_MS = 1600
const MAX_MS = 4000

/** First visit of the session: logo until the page (load + fonts) is ready, at least 1.6 s and at most 4 s, then a 0.4 s fade. */
export function SitePreloader() {
  const [gone, setGone] = useState(false)
  const [hiding, setHiding] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    if (root.dataset.preloader !== "show") return
    try {
      sessionStorage.setItem(PRELOADER_KEY, "1")
    } catch {}

    const started = performance.now()
    const loaded = new Promise<void>((resolve) => {
      if (document.readyState === "complete") resolve()
      else window.addEventListener("load", () => resolve(), { once: true })
    })
    const ready = Promise.all([loaded, document.fonts?.ready ?? Promise.resolve()])
    const cap = new Promise<void>((resolve) => window.setTimeout(resolve, MAX_MS))
    let hideTimer = 0
    let doneTimer = 0

    Promise.race([ready, cap]).then(() => {
      const wait = Math.max(0, MIN_MS - (performance.now() - started))
      hideTimer = window.setTimeout(() => {
        root.dataset.preloader = "done"
        window.dispatchEvent(new Event(PRELOADER_EVENT))
        setHiding(true)
        doneTimer = window.setTimeout(() => setGone(true), 400)
      }, wait)
    })

    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(doneTimer)
    }
  }, [])

  if (gone) return null
  return (
    <div
      id="site-preloader"
      className={
        "fixed inset-0 z-[100] transition-opacity duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] " + (hiding ? "pointer-events-none opacity-0" : "opacity-100")
      }
    >
      <LoadingScreen preload />
    </div>
  )
}
