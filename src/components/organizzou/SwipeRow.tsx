"use client"

import { useRef, useState } from "react"
import { CheckIcon, Trash2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

type SwipeRowProps = {
  children: React.ReactNode
  /** Swipe right (touch only). */
  onSwipeRight?: () => void
  rightLabel?: string
  /** Swipe left (touch only). Should open a confirmation, never delete directly. */
  onSwipeLeft?: () => void
  leftLabel?: string
  className?: string
}

const THRESHOLD = 72
const MAX = 112

// Touch-only swipe gestures; mouse and keyboard users get the regular buttons inside the row.
export function SwipeRow({
  children,
  onSwipeRight,
  rightLabel = "Concluir",
  onSwipeLeft,
  leftLabel = "Excluir",
  className,
}: SwipeRowProps) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return
    start.current = { x: e.clientX, y: e.clientY, locked: null }
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = start.current
    if (!s) return
    const deltaX = e.clientX - s.x
    const deltaY = e.clientY - s.y
    if (s.locked === null && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
      s.locked = Math.abs(deltaX) > Math.abs(deltaY) * 1.5
    }
    if (!s.locked) return
    setDragging(true)
    const allowed = (deltaX > 0 && onSwipeRight) || (deltaX < 0 && onSwipeLeft) ? deltaX : 0
    setDx(Math.max(-MAX, Math.min(MAX, allowed)))
  }

  function finish() {
    const current = dx
    start.current = null
    setDragging(false)
    setDx(0)
    if (current >= THRESHOLD) onSwipeRight?.()
    else if (current <= -THRESHOLD) onSwipeLeft?.()
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div aria-hidden className="absolute inset-0 flex items-center justify-between bg-muted px-4 text-sm font-medium">
        <span className={cn("flex items-center gap-2", dx > 0 ? "opacity-100" : "opacity-0")}>
          <CheckIcon strokeWidth={1.75} className="size-5" /> {rightLabel}
        </span>
        <span className={cn("flex items-center gap-2", dx < 0 ? "opacity-100" : "opacity-0")}>
          {leftLabel} <Trash2Icon strokeWidth={1.75} className="size-5" />
        </span>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        style={{ transform: `translateX(${dx}px)` }}
        className={cn(
          "relative touch-pan-y bg-background",
          !dragging && "transition-transform duration-200 ease-organizzou"
        )}
      >
        {children}
      </div>
    </div>
  )
}
