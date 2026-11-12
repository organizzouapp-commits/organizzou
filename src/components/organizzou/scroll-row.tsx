"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

/** The scrollLeft that puts `child` in the middle of `scroller`, kept inside the scrollable range (pure, so it can be tested). */
export function centerScrollLeft(scrollerWidth: number, scrollWidth: number, childLeft: number, childWidth: number): number {
  const target = childLeft + childWidth / 2 - scrollerWidth / 2
  return Math.max(0, Math.min(scrollWidth - scrollerWidth, target))
}

const FOCUSABLE = 'button:not([disabled]), [role="radio"], a[href]'

/**
 * A single row that scrolls sideways when it does not fit: touch pan, mouse drag, the wheel (vertical wheel turns into horizontal), arrow keys
 * that move focus between the controls (and bring the focused one into view), faded edges where there is more, and the selected control
 * (`aria-checked="true"`) centered on open. No scrollbar. Children keep their own click behavior (a drag never counts as a click).
 */
export function ScrollRow({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, moved: false, startX: 0, startLeft: 0 })
  const [edges, setEdges] = useState({ start: false, end: false })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    setEdges({ start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const selected = el.querySelector<HTMLElement>('[aria-checked="true"]')
    if (selected) el.scrollLeft = centerScrollLeft(el.clientWidth, el.scrollWidth, selected.offsetLeft, selected.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  // The wheel: a vertical turn scrolls the row, but only while the row can still move that way (otherwise the page scrolls as usual).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const next = Math.max(0, Math.min(max, el.scrollLeft + event.deltaY))
      if (next === el.scrollLeft) return
      event.preventDefault()
      el.scrollLeft = next
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const mask = edges.start && edges.end ? "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)" : edges.start ? "linear-gradient(to right, transparent, black 24px)" : edges.end ? "linear-gradient(to left, transparent, black 24px)" : undefined

  return (
    <div
      {...rest}
      ref={ref}
      style={{ ...rest.style, maskImage: mask, WebkitMaskImage: mask }}
      onScroll={(event) => (measure(), rest.onScroll?.(event))}
      onPointerDown={(event) => {
        rest.onPointerDown?.(event)
        // Mouse only: touch already pans natively.
        if (event.pointerType !== "mouse" || event.button !== 0 || !ref.current) return
        drag.current = { active: true, moved: false, startX: event.clientX, startLeft: ref.current.scrollLeft }
      }}
      onPointerMove={(event) => {
        const state = drag.current
        if (!state.active || !ref.current) return
        const delta = event.clientX - state.startX
        if (!state.moved && Math.abs(delta) > 4) {
          state.moved = true
          ref.current.setPointerCapture(event.pointerId)
        }
        if (state.moved) ref.current.scrollLeft = state.startLeft - delta
      }}
      onPointerUp={() => {
        drag.current.active = false
      }}
      onPointerCancel={() => {
        drag.current.active = false
      }}
      onClickCapture={(event) => {
        if (drag.current.moved) {
          event.preventDefault()
          event.stopPropagation()
          drag.current.moved = false
        }
      }}
      onKeyDown={(event) => {
        rest.onKeyDown?.(event)
        if (event.defaultPrevented || !ref.current) return
        const keys = ["ArrowLeft", "ArrowRight", "Home", "End"]
        if (!keys.includes(event.key)) return
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        const index = items.indexOf(document.activeElement as HTMLElement)
        if (index < 0) return
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : Math.max(0, Math.min(items.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)))
        event.preventDefault()
        const target = items[next]
        target.focus({ preventScroll: true })
        const el = ref.current
        el.scrollLeft = centerScrollLeft(el.clientWidth, el.scrollWidth, target.offsetLeft, target.offsetWidth)
      }}
      className={cn("no-scrollbar relative touch-pan-x overflow-x-auto overscroll-x-contain", className)}
    >
      {children}
    </div>
  )
}
