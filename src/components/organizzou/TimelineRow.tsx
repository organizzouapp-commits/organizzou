"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CalendarDaysIcon, CalendarIcon, ClockIcon, DumbbellIcon, EllipsisIcon, FlagIcon, GraduationCapIcon, ReceiptTextIcon, SquareCheckIcon, type LucideIcon } from "lucide-react"

import { agoText, clock, dayKey, durationText, remainingText } from "@/components/organizzou/today/day-format"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { DayItem, DayItemKind } from "@/features/today/types"
import { cn } from "@/lib/utils"

/**
 * One row of the day, for every module (tasks, events, workouts, studies, bills). Desktop: a grid of
 * [44px control][72px time][title + meta][trailing]; phones: control, title + meta (the time moves into the meta line), trailing.
 * The control is always on the LEFT: a circular checkbox for what can be completed, a calendar icon for events.
 */

const KIND_ICON: Record<DayItemKind, LucideIcon> = {
  task: SquareCheckIcon,
  event: CalendarDaysIcon,
  workout: DumbbellIcon,
  study: GraduationCapIcon,
  habit: SquareCheckIcon,
  bill: ReceiptTextIcon,
}

const CHECK_LABEL: Record<DayItemKind, [string, string]> = {
  task: ["Concluir", "Reabrir"],
  workout: ["Marcar como feito", "Reabrir"],
  bill: ["Marcar como paga", "Reabrir"],
  event: ["", ""],
  study: ["", ""],
  habit: ["Concluir", "Reabrir"],
}

export type RowHandlers = {
  /** Present when the row can be completed (tasks, workouts, bills). */
  toggle?: (checked: boolean) => void
  /** Tasks only. */
  postpone1h?: () => void
  tomorrow?: () => void
  /** Bills: the "Pagar" button. */
  pay?: () => void
}

export type RowCurrent = { endsAt: string; remaining: string; pct: number; range: string }

type Props = {
  item: DayItem
  done: boolean
  nowMs: number
  handlers?: RowHandlers
  /** Set on the item that is happening now: highlighted block with a progress bar of elapsed time. */
  current?: RowCurrent
  dimmed?: boolean
  className?: string
}

const SWIPE_OPEN = 152
const SWIPE_THRESHOLD = 44

/** Touch swipe left reveals two 76px actions (the same two as the hover buttons); a long press opens the menu for everyone else. */
function SwipeActions({ enabled, onPostpone1h, onTomorrow, children }: { enabled: boolean; onPostpone1h: () => void; onTomorrow: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  if (!enabled) return <>{children}</>

  const offset = dragging ? Math.max(-SWIPE_OPEN, Math.min(0, (open ? -SWIPE_OPEN : 0) + dx)) : open ? -SWIPE_OPEN : 0
  const finish = () => {
    const moved = dx
    start.current = null
    setDragging(false)
    setDx(0)
    if (moved <= -SWIPE_THRESHOLD) setOpen(true)
    else if (moved >= SWIPE_THRESHOLD / 2) setOpen(false)
  }
  const act = (run: () => void) => () => {
    setOpen(false)
    run()
  }
  const panel = "flex w-[76px] flex-col items-center justify-center gap-1 text-[12px] leading-4 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

  return (
    <div ref={host} className="relative overflow-hidden md:overflow-visible">
      <div aria-hidden={!open} className="absolute inset-y-0 right-0 flex md:hidden" style={{ width: SWIPE_OPEN }}>
        <button type="button" data-pill-exempt tabIndex={open ? 0 : -1} onClick={act(onPostpone1h)} className={cn(panel, "bg-foreground/10")}>
          <ClockIcon aria-hidden strokeWidth={1.75} className="size-5" />
          Adiar 1 h
        </button>
        <button type="button" data-pill-exempt tabIndex={open ? 0 : -1} onClick={act(onTomorrow)} className={cn(panel, "bg-foreground/[0.16]")}>
          <CalendarIcon aria-hidden strokeWidth={1.75} className="size-5" />
          Amanhã
        </button>
      </div>
      <div
        onPointerDown={(e) => {
          if (e.pointerType === "touch") start.current = { x: e.clientX, y: e.clientY, locked: null }
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s) return
          const ax = e.clientX - s.x
          const ay = e.clientY - s.y
          if (s.locked === null && (Math.abs(ax) > 8 || Math.abs(ay) > 8)) s.locked = Math.abs(ax) > Math.abs(ay) * 1.5
          if (!s.locked) return
          setDragging(true)
          setDx(ax)
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        style={{ transform: `translateX(${offset}px)` }}
        className={cn("relative touch-pan-y bg-card md:!transform-none", !dragging && "transition-transform duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none")}
      >
        {children}
      </div>
    </div>
  )
}

/** "atrasada há 14 h" / "venceu ontem": the overdue wording, in foreground 500. */
function overdueText(item: DayItem, nowMs: number) {
  if (!item.overdue || !item.overdueSince) return null
  if (item.bill) {
    const days = Math.round((Date.parse(`${dayKey(nowMs)}T12:00:00Z`) - Date.parse(`${dayKey(item.overdueSince)}T12:00:00Z`)) / 86_400_000)
    return days <= 1 ? "venceu ontem" : `venceu há ${days} dias`
  }
  return `atrasada ${agoText(new Date(item.overdueSince).getTime(), nowMs)}`
}

/** The time column: "09:00" (+ duration), "Ontem" for older overdue items, "Dia todo" or "—". */
function timeColumn(item: DayItem, nowMs: number): { main: string; sub?: string; muted?: boolean } {
  if (item.at) {
    const sameDay = dayKey(item.at) === dayKey(nowMs)
    if (!sameDay && item.overdue) return { main: dayKey(item.at) === dayKey(nowMs - 86_400_000) ? "Ontem" : new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" }).format(new Date(item.at)).replace(".", ""), muted: true }
    return { main: clock(item.at), sub: durationText(item.durationMin) ?? undefined }
  }
  if (item.overdue && item.overdueSince && dayKey(item.overdueSince) !== dayKey(nowMs)) {
    return { main: dayKey(item.overdueSince) === dayKey(nowMs - 86_400_000) ? "Ontem" : new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" }).format(new Date(item.overdueSince)).replace(".", ""), muted: true }
  }
  if (item.kind === "event" && item.meta.includes("Dia todo")) return { main: "Dia todo", muted: true }
  return { main: "—", muted: true }
}

export function TimelineRow({ item, done, nowMs, handlers = {}, current, dimmed, className }: Props) {
  const KindIcon = KIND_ICON[item.kind]
  const [menu, setMenu] = useState(false)
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined)
  const canToggle = Boolean(handlers.toggle)
  const canPostpone = Boolean(handlers.postpone1h && handlers.tomorrow) && !done
  const [checkLabel, reopenLabel] = CHECK_LABEL[item.kind]

  const startHold = (event: React.PointerEvent) => {
    if (event.pointerType !== "touch" || (!canToggle && !canPostpone)) return
    hold.current = setTimeout(() => setMenu(true), 550)
  }
  const stopHold = () => clearTimeout(hold.current)
  useEffect(() => () => clearTimeout(hold.current), [])

  const [, ...detailParts] = item.meta.split(" · ")
  const detail = detailParts.filter((part) => part !== "Dia todo").join(" · ")
  const late = done ? null : overdueText(item, nowMs)
  const time = timeColumn(item, nowMs)
  const mobileTime = item.at && !(item.overdue && dayKey(item.at) !== dayKey(nowMs)) ? clock(item.at) : null

  const control = canToggle ? (
    <span className="flex size-11 items-center justify-center">
      <Checkbox
        checked={done}
        onCheckedChange={(value) => handlers.toggle?.(value === true)}
        aria-label={`${done ? reopenLabel : checkLabel}: ${item.title}`}
        className="size-[22px] after:-inset-x-3 after:-inset-y-3 md:size-5 active:scale-90 data-checked:animate-in data-checked:zoom-in-90 data-checked:duration-[400ms] motion-reduce:animate-none motion-reduce:transition-none [&_svg]:size-3.5"
      />
    </span>
  ) : (
    <span className="flex size-11 items-center justify-center text-muted-foreground">
      <KindIcon role="img" aria-label={item.kind === "event" ? "Evento" : item.kind === "study" ? "Estudo" : "Item"} strokeWidth={1.75} className="size-5" />
    </span>
  )

  const body = (
    <div className="flex min-w-0 flex-col gap-0.5">
      {current ? (
        <span className="flex items-center gap-2 md:hidden">
          <span className="inline-flex h-6 items-center rounded-full bg-highlight px-2.5 text-[12px] leading-4 font-semibold text-highlight-foreground">Agora</span>
          <span className="tabular text-[12px] leading-4 text-muted-foreground">{current.range}</span>
        </span>
      ) : null}
      <Link href={item.href} className={cn("flex min-w-0 flex-col justify-center gap-0.5 rounded-md outline-none max-md:min-h-11 focus-visible:ring-3 focus-visible:ring-ring/50", current && "gap-1")}>
        <span className={cn("min-w-0 leading-5 font-semibold [overflow-wrap:anywhere]", current ? "text-[16px]" : "text-[15px]", done && "text-muted-foreground line-through decoration-1")}>
          {item.priority === "high" ? (
            <>
              {item.title.slice(0, item.title.lastIndexOf(" ") + 1)}
              {/* The last word and the flag never separate. */}
              <span className="whitespace-nowrap">
                {item.title.slice(item.title.lastIndexOf(" ") + 1)}
                <FlagIcon role="img" aria-label="Prioridade alta" strokeWidth={1.75} className="ml-1.5 inline size-3.5 -translate-y-px text-muted-foreground" />
              </span>
            </>
          ) : (
            item.title
          )}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px] leading-5 text-muted-foreground">
          <KindIcon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
          {mobileTime && !current ? <span className="tabular md:hidden">{mobileTime}{detail || late ? " ·" : ""}</span> : null}
          {detail ? (
            <span className="min-w-0 truncate">
              {detail}
              {current || late ? " ·" : ""}
            </span>
          ) : null}
          {current ? (
            <span className="tabular">
              termina às {current.endsAt} · faltam {current.remaining}
            </span>
          ) : null}
          {late ? <span className="font-medium text-foreground">{late}</span> : null}
        </span>
      </Link>
      {current ? (
        <div aria-hidden className="mt-1 h-1 w-full max-w-full overflow-hidden rounded-full bg-muted md:max-w-[360px]">
          <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.min(100, Math.max(0, current.pct))}%` }} />
        </div>
      ) : null}
    </div>
  )

  const trailing = current ? (
    <span className="hidden h-7 items-center rounded-full bg-highlight px-3 text-[13px] leading-5 font-semibold text-highlight-foreground md:inline-flex">Agora</span>
  ) : item.bill ? (
    <span className="flex items-center gap-3">
      <span className="tabular text-[15px] leading-5 font-semibold">{item.bill.amount}</span>
      {handlers.pay && !done ? (
        <Button type="button" variant="secondary" className="hidden h-9 rounded-full bg-foreground/8 px-4 text-[14px] hover:bg-foreground/12 md:inline-flex" aria-label={`Pagar ${item.title}`} onClick={handlers.pay}>
          Pagar
        </Button>
      ) : null}
    </span>
  ) : canPostpone ? (
    <span className="absolute top-1/2 right-1 z-10 hidden -translate-y-1/2 items-center gap-1 rounded-full bg-card pl-2 opacity-0 transition-opacity duration-[400ms] group-focus-within/row:opacity-100 group-hover/row:opacity-100 motion-reduce:transition-none md:flex">
      <Button type="button" variant="ghost" className="h-9 gap-1.5 rounded-full px-3 text-[13px]" onClick={handlers.postpone1h}>
        <ClockIcon strokeWidth={1.75} className="size-4" /> Adiar 1 h
      </Button>
      <Button type="button" variant="ghost" className="h-9 gap-1.5 rounded-full px-3 text-[13px]" onClick={handlers.tomorrow}>
        <CalendarIcon strokeWidth={1.75} className="size-4" /> Amanhã
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Mais ações" onClick={() => setMenu(true)}>
        <EllipsisIcon strokeWidth={1.75} />
      </Button>
    </span>
  ) : null

  const row = (
    <div
      data-kind={item.kind}
      data-done={done ? "" : undefined}
      data-current={current ? "" : undefined}
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      onContextMenu={(event) => {
        if (!canToggle && !canPostpone) return
        event.preventDefault()
        setMenu(true)
      }}
      className={cn(
        "relative grid min-h-16 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-2 py-2 pr-2 pl-0 md:grid-cols-[44px_72px_minmax(0,1fr)_auto] md:gap-x-3",
        current ? "rounded-2xl bg-foreground/6 py-3 pl-1" : "md:rounded-xl md:px-1 md:hover:bg-foreground/5 md:focus-within:bg-foreground/5",
        dimmed && "opacity-60"
      )}
    >
      {control}
      <span className={cn("tabular hidden min-w-0 flex-col md:flex", time.muted && "text-muted-foreground")}>
        <span className={cn("text-[14px] leading-5", !time.muted && "font-semibold")}>{time.main}</span>
        {time.sub ? <span className="text-[12px] leading-4 text-muted-foreground">{time.sub}</span> : null}
      </span>
      {body}
      <span className="flex items-center justify-end">{trailing}</span>

      {canToggle || canPostpone ? (
        <DropdownMenu open={menu} onOpenChange={setMenu}>
          <DropdownMenuTrigger asChild>
            <span aria-hidden tabIndex={-1} className="pointer-events-none absolute right-2 bottom-0 size-px" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" collisionPadding={{ top: 16, bottom: 104, left: 16, right: 16 }} className="min-w-52 rounded-2xl p-2">
            {canToggle ? (
              <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => handlers.toggle?.(!done)}>
                <SquareCheckIcon strokeWidth={1.75} /> {done ? reopenLabel : checkLabel}
              </DropdownMenuItem>
            ) : null}
            {canPostpone ? (
              <>
                <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={handlers.postpone1h}>
                  <ClockIcon strokeWidth={1.75} /> Adiar 1 h
                </DropdownMenuItem>
                <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={handlers.tomorrow}>
                  <CalendarIcon strokeWidth={1.75} /> Amanhã
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )

  return (
    <div className={cn("group/row border-b border-border last:border-b-0", current && "border-b-0 py-1", className)} data-row={item.id}>
      <SwipeActions enabled={canPostpone} onPostpone1h={() => handlers.postpone1h?.()} onTomorrow={() => handlers.tomorrow?.()}>
        {row}
      </SwipeActions>
    </div>
  )
}

export { remainingText }
