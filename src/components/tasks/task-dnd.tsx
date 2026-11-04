"use client"

import { createContext, useContext, useEffect, useRef } from "react"
import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"

/** True while a task is being dragged: swipe actions stand down so a drag never doubles as a swipe. */
const TaskDragContext = createContext(false)
export const TaskDragProvider = TaskDragContext.Provider
export const useTaskDragging = () => useContext(TaskDragContext)

/** Long press (250 ms, 8 px of wiggle) starts a drag on touch so vertical scroll and horizontal swipes keep working; mouse after 4 px; keyboard too. */
export function useTaskSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
}

/** A small tick when the drag lifts (where the device supports it). */
export function hapticTick() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10)
  } catch {
    // Not every browser allows it.
  }
}

export const DRAG_OVERLAY_CLASS = "scale-[0.98] shadow-[var(--shadow-lift)] opacity-95"

type Hover = { kind: "tab" | "group"; id: string; element: HTMLElement }

/**
 * While `active`, follows the finger / pointer and reports the tab or group header under it. After `delay` ms over the same one,
 * `onDwell` fires (a Kanban tab switches list, a collapsed Lista group opens). `hoverRef` always holds the current target so a
 * drop on a tab can append to that list.
 */
export function useDragHover(active: boolean, onDwell: (hover: Hover) => void, delay = 500) {
  const hoverRef = useRef<Hover | null>(null)
  const dwell = useRef(onDwell)
  useEffect(() => {
    dwell.current = onDwell
  })

  useEffect(() => {
    if (!active) return
    let timer: number | undefined
    let last: Hover | null = null
    const setHover = (next: Hover | null) => {
      if (last?.element === next?.element) return
      last?.element.removeAttribute("data-drop-hover")
      last = next
      hoverRef.current = next
      window.clearTimeout(timer)
      if (next) {
        next.element.setAttribute("data-drop-hover", "")
        timer = window.setTimeout(() => dwell.current(next), delay)
      }
    }
    const move = (x: number, y: number) => {
      const under = document.elementsFromPoint(x, y)
      for (const el of under) {
        const tab = el.closest<HTMLElement>("[data-list-tab]")
        if (tab) return setHover({ kind: "tab", id: tab.dataset.listTab!, element: tab })
        const group = el.closest<HTMLElement>("[data-drop-group]")
        if (group && el.closest("[data-group-header]")) return setHover({ kind: "group", id: group.dataset.dropGroup!, element: group })
      }
      setHover(null)
    }
    const onPointer = (e: PointerEvent | MouseEvent) => move(e.clientX, e.clientY)
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0] ?? e.changedTouches[0]
      if (t) move(t.clientX, t.clientY)
    }
    window.addEventListener("pointermove", onPointer)
    window.addEventListener("mousemove", onPointer)
    window.addEventListener("touchmove", onTouch, { passive: true })
    return () => {
      window.clearTimeout(timer)
      last?.element.removeAttribute("data-drop-hover")
      window.removeEventListener("pointermove", onPointer)
      window.removeEventListener("mousemove", onPointer)
      window.removeEventListener("touchmove", onTouch)
      // The drop handler runs right after this cleanup; keep the last target for it for one tick.
      const keep = hoverRef.current
      window.setTimeout(() => {
        if (hoverRef.current === keep) hoverRef.current = null
      }, 0)
    }
  }, [active, delay])

  return hoverRef
}
