"use client"

import { useEffect, useRef } from "react"

/** Desktop-only soft Lima glow that trails the mouse. Off on touch devices and with prefers-reduced-motion. */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)")
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!fine.matches || reduced.matches) return

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    let x = mouseX
    let y = mouseY
    let frame = 0

    function onMove(event: MouseEvent) {
      mouseX = event.clientX
      mouseY = event.clientY
      if (el) el.style.opacity = "1"
    }
    const onLeave = () => {
      if (el) el.style.opacity = "0"
    }
    function tick() {
      x += (mouseX - x) * 0.1
      y += (mouseY - y) * 0.1
      if (el) el.style.transform = `translate3d(${x - 200}px, ${y - 200}px, 0)`
      frame = requestAnimationFrame(tick)
    }

    document.addEventListener("mousemove", onMove)
    document.documentElement.addEventListener("mouseleave", onLeave)
    frame = requestAnimationFrame(tick)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.documentElement.removeEventListener("mouseleave", onLeave)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-30 hidden size-[400px] rounded-full opacity-0 transition-opacity duration-[400ms] [@media(hover:hover)_and_(pointer:fine)]:block motion-reduce:hidden"
      style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--palette-lima) 10%, transparent) 0%, transparent 70%)" }}
    />
  )
}
