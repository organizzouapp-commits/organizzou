"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A horizontally scrollable row (the first `[data-pill-row]` inside it): hidden scrollbar, mouse wheel and drag, touch scroll, and small circle
 * chevrons that only exist while there is more to scroll in that direction. `pinned` sits after the scroller and never scrolls away.
 */
export function ScrollRow({ children, pinned, className }: { children: React.ReactNode; pinned?: React.ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  useEffect(() => {
    const scroller = wrap.current?.querySelector<HTMLElement>("[data-pill-row]")
    if (!scroller) return
    const update = () => {
      const next = { left: scroller.scrollLeft > 2, right: scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2 }
      setEdges((current) => (current.left === next.left && current.right === next.right ? current : next))
    }
    update()
    scroller.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(scroller)
    // Pills come and go with the categories: measure again when the row changes.
    const mutations = new MutationObserver(update)
    mutations.observe(scroller, { childList: true, subtree: true, characterData: true })

    // A mouse wheel (vertical) scrolls the row while it can still move that way; trackpads and touch already scroll sideways.
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
      const max = scroller.scrollWidth - scroller.clientWidth
      if (max <= 0) return
      const next = scroller.scrollLeft + event.deltaY
      if (next < 0 || next > max) return
      event.preventDefault()
      scroller.scrollLeft = next
    }
    scroller.addEventListener("wheel", onWheel, { passive: false })

    // Click and drag with a mouse; a drag never counts as a click on the pill under the pointer.
    let startX = 0
    let startLeft = 0
    let dragging = false
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return
      startX = event.clientX
      startLeft = scroller.scrollLeft
      dragging = false
      const move = (e: PointerEvent) => {
        if (Math.abs(e.clientX - startX) > 4) dragging = true
        if (dragging) scroller.scrollLeft = startLeft - (e.clientX - startX)
      }
      const up = () => {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
        if (dragging) window.addEventListener("click", (e) => e.stopPropagation(), { capture: true, once: true })
      }
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
    }
    scroller.addEventListener("pointerdown", onDown)
    return () => {
      scroller.removeEventListener("scroll", update)
      scroller.removeEventListener("wheel", onWheel)
      scroller.removeEventListener("pointerdown", onDown)
      observer.disconnect()
      mutations.disconnect()
    }
  }, [])

  const nudge = (direction: -1 | 1) => {
    const scroller = wrap.current?.querySelector<HTMLElement>("[data-pill-row]")
    scroller?.scrollBy({ left: direction * scroller.clientWidth * 0.7, behavior: "smooth" })
  }
  const chevron = "absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground outline-none transition-colors duration-[400ms] after:absolute after:-inset-1.5 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <div ref={wrap} className="relative min-w-0 flex-1">
        {edges.left ? (
          <button type="button" aria-label="Rolar categorias para a esquerda" data-scroll="left" onClick={() => nudge(-1)} className={cn(chevron, "left-0")}>
            <ChevronLeftIcon aria-hidden strokeWidth={1.75} className="size-4" />
          </button>
        ) : null}
        {children}
        {edges.right ? (
          <button type="button" aria-label="Rolar categorias para a direita" data-scroll="right" onClick={() => nudge(1)} className={cn(chevron, "right-0")}>
            <ChevronRightIcon aria-hidden strokeWidth={1.75} className="size-4" />
          </button>
        ) : null}
      </div>
      {pinned}
    </div>
  )
}
