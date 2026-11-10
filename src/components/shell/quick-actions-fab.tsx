"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { XIcon, type LucideIcon } from "lucide-react"

import { LogoMark } from "@/components/organizzou/logo-mark"
import { useIsMobile } from "@/hooks/use-mobile"
import { useOverlayOpen } from "@/hooks/use-overlay-open"
import { useTextEntryFocused } from "@/hooks/use-text-entry-focused"
import { cn } from "@/lib/utils"

/** `contextual` = an action of the current screen (Lima fill); the global ones are neutral. */
export type FabItem = { id: string; label: string; icon: LucideIcon; contextual?: boolean; onSelect: () => void }

const HOVER_OPEN_MS = 120
const HOVER_CLOSE_MS = 200

/**
 * The speed dial: one 56px Lima button (the brand mark, turning into an X while open) floating bottom-right, with its actions stacked above it.
 * `items` go from the button upward. Desktop opens on hover (after a short intent delay), click or keyboard focus; touch opens on tap and closes
 * on a second tap, the scrim, Esc, a selection or a route change. It steps aside while a dialog or sheet is open, and on phones while the
 * keyboard is up. Menu semantics: aria-haspopup, arrow keys, Home/End; Esc returns focus to the button.
 */
export function QuickActionsFab({ items }: { items: FabItem[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const overlay = useOverlayOpen()
  const typing = useTextEntryFocused()
  const menuId = useId()
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const byHover = useRef(false)

  const close = useCallback(() => {
    window.clearTimeout(timer.current)
    byHover.current = false
    setOpen(false)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  // A new route closes the menu.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    close()
  }, [pathname, close])
  // A dialog opening on top hides the whole button, so the menu closes too.
  const hidden = overlay || (isMobile && typing)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hidden) close()
  }, [hidden, close])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      close()
      button.current?.focus()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, close])

  const entries = () => Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
  const focusItem = (index: number) => {
    const nodes = entries()
    if (nodes.length > 0) nodes[(index + nodes.length) % nodes.length].focus()
  }

  if (hidden || items.length === 0) return null

  const onPointerEnter = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return
    window.clearTimeout(timer.current)
    if (open) return
    timer.current = window.setTimeout(() => {
      byHover.current = true
      setOpen(true)
    }, HOVER_OPEN_MS)
  }
  const onPointerLeave = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return
    window.clearTimeout(timer.current)
    // A menu opened by hover closes after a grace period; one the person clicked open stays until they click away.
    if (open && byHover.current) timer.current = window.setTimeout(close, HOVER_CLOSE_MS)
  }

  return (
    <>
      {/* Touch: a light scrim behind the open menu; a tap on it closes. Devices with hover have no scrim. */}
      {open ? <div aria-hidden data-testid="quick-actions-scrim" onClick={close} className="fixed inset-0 z-20 bg-background/40 [@media(hover:hover)]:hidden" /> : null}
      <div
        ref={root}
        data-testid="quick-actions"
        data-open={open}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-30 flex flex-col items-end md:right-6 md:bottom-6"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onBlur={(event) => {
          const next = event.relatedTarget as Node | null
          if (open && next && !event.currentTarget.contains(next)) close()
        }}
      >
        {/* The items sit above the button, nearest first. The bottom padding keeps the hover area continuous between them. */}
        <div
          id={menuId}
          role="menu"
          aria-label="Ações rápidas"
          inert={!open}
          className="absolute right-0 bottom-full flex flex-col-reverse items-end gap-3 pb-3"
          onKeyDown={(event) => {
            const index = entries().indexOf(document.activeElement as HTMLElement)
            if (event.key === "ArrowUp") focusItem(index + 1)
            else if (event.key === "ArrowDown") focusItem(index - 1)
            else if (event.key === "Home") focusItem(0)
            else if (event.key === "End") focusItem(-1)
            else return
            event.preventDefault()
          }}
        >
          {items.map((item, index) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                data-testid={`quick-action-${item.id}`}
                onClick={() => {
                  close()
                  item.onSelect()
                }}
                style={{ "--d": `${index * 40}ms` } as React.CSSProperties}
                className={cn(
                  "flex items-center gap-3 rounded-full outline-none transition-[opacity,transform] duration-[180ms] ease-out [transition-delay:var(--d)] focus-visible:[&>span:last-child]:ring-3 focus-visible:[&>span:last-child]:ring-ring/50 motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:transition-opacity motion-reduce:[transition-delay:0ms]",
                  open ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-90 opacity-0 [transition-delay:0ms]"
                )}
              >
                <span className="rounded-full border border-border bg-popover px-3 py-1.5 text-[13px] leading-5 font-medium whitespace-nowrap text-popover-foreground">{item.label}</span>
                <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", item.contextual ? "bg-highlight text-highlight-foreground" : "border border-border bg-card text-foreground")}>
                  <Icon aria-hidden strokeWidth={1.75} className="size-5" />
                </span>
              </button>
            )
          })}
        </div>
        <button
          ref={button}
          type="button"
          aria-label={open ? "Fechar ações rápidas" : "Ações rápidas"}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          data-testid="quick-actions-button"
          onClick={() => {
            window.clearTimeout(timer.current)
            if (open && byHover.current) {
              // Opened by hovering: a click keeps it open (the person meant to use it) instead of closing it under the pointer.
              byHover.current = false
              return
            }
            setOpen((value) => !value)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault()
              setOpen(true)
              window.setTimeout(() => focusItem(0), 0)
            }
          }}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) setOpen(true)
          }}
          className="relative flex size-14 items-center justify-center rounded-full bg-highlight text-highlight-foreground outline-none transition-transform duration-120 ease-organizzou focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
        >
          <LogoMark className={cn("absolute size-7 transition-[opacity,transform] duration-200 motion-reduce:transition-opacity", open ? "scale-75 rotate-90 opacity-0" : "opacity-100")} />
          <XIcon aria-hidden strokeWidth={2} className={cn("absolute size-6 transition-[opacity,transform] duration-200 motion-reduce:transition-opacity", open ? "opacity-100" : "-rotate-90 scale-75 opacity-0")} />
        </button>
      </div>
    </>
  )
}
