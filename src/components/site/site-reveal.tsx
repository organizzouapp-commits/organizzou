"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Keeps the page content invisible until the background photo (#site-bg) is decoded: first the solid theme background, then the
 * photo and the content fade in together (0.4 s). Without this the glass pill is painted alone on a black screen for a moment.
 * No JavaScript: a <noscript> rule in the page shows the content.
 */
export function SiteReveal({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const img = document.getElementById("site-bg") as HTMLImageElement | null
    let cancelled = false
    const show = () => {
      if (!cancelled) setReady(true)
    }
    if (!img) {
      show()
      return
    }
    // decode() resolves once the image can be painted without a flash; it also resolves right away if it is already decoded.
    img.decode().then(show, show)
    // Never keep the page hidden for long if the image is slow or fails.
    const timer = window.setTimeout(show, 3000)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div id="site-reveal" className={cn("flex flex-1 flex-col transition-opacity duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none", ready ? "opacity-100" : "opacity-0")}>
      {children}
    </div>
  )
}
