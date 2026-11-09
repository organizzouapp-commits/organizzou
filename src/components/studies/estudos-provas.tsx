"use client"

import { useEffect, useState } from "react"
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"

import { BentoCard } from "@/components/finance/bento"
import { HeroCard, LIST_CARD } from "@/components/finance/parts"
import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { QuickAdd } from "@/components/organizzou/quick-add"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  TYPE_LABELS,
  dayBlock,
  daysLeft,
  formatLong,
  formatShort,
  groupDeadlines,
  monthCells,
  monthTitle,
  nextDeadline,
  shiftMonth,
  typeOf,
  type DeadlineMetaMap,
  type DeadlineType,
  type GroupId,
} from "@/features/studies/deadlines"
import type { DeadlineRow, SubjectRow } from "@/features/studies/types"
import { cn } from "@/lib/utils"

const chip = "tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"]
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const dim = (text: string) => <span className="text-[16px] leading-6 opacity-60">{text}</span>

type Props = {
  deadlines: DeadlineRow[]
  subjects: SubjectRow[]
  metas: DeadlineMetaMap
  today: string
  isMobile: boolean
  onQuick: (text: string) => void
  onEdit: (row: DeadlineRow) => void
  onToggleDone: (row: DeadlineRow) => void
  onDelete: (row: DeadlineRow) => void
}

// ------------------------------------------------------------------ one row

function DayBlockBox({ left, done }: { left: number; done: boolean }) {
  if (done) {
    return (
      <span aria-hidden data-block="done" className="flex size-14 shrink-0 items-center justify-center rounded-[12px] border border-border text-muted-foreground">
        <CheckIcon strokeWidth={1.75} className="size-5" />
      </span>
    )
  }
  const b = dayBlock(left)
  return (
    <span data-block={b.kind} data-solid={b.solid} className={cn("tabular flex size-14 shrink-0 flex-col items-center justify-center rounded-[12px] leading-none", b.solid ? "bg-highlight text-highlight-foreground" : b.kind === "overdue" ? "border-2 border-foreground/60" : "border border-border")}>
      <span className={cn("font-semibold", b.kind === "today" ? "text-[15px]" : "text-[22px]")}>{b.kind === "overdue" ? `−${b.big}` : b.big}</span>
      {b.small ? <span className={cn("mt-1 text-[11px]", b.solid ? "opacity-75" : "text-muted-foreground")}>{b.small}</span> : null}
    </span>
  )
}

function DeadlineItem({ row, type, subject, done, today, highlighted, isMobile, onEdit, onToggleDone, onDelete }: { row: DeadlineRow; type: DeadlineType; subject: SubjectRow | undefined; done: boolean; today: string; highlighted: boolean; isMobile: boolean; onEdit: () => void; onToggleDone: () => void; onDelete: () => void }) {
  const left = daysLeft(row.due_on, today)
  const meta = `${formatLong(row.due_on)} · ${TYPE_LABELS[type]}`
  return (
    <li id={`deadline-${row.id}`} data-deadline={row.id} data-done={done} data-highlight={highlighted} className={cn(LIST_CARD, "flex min-h-[72px] items-center gap-3 p-2 transition-shadow duration-[400ms] motion-reduce:transition-none", highlighted && "ring-2 ring-primary", done && "opacity-60")}>
      <DayBlockBox left={left} done={done} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-[15px] leading-5 font-semibold", isMobile ? "line-clamp-2" : "truncate", done && "line-through")}>{row.title}</span>
        <span data-meta className="truncate text-[13px] leading-5 text-muted-foreground">
          {meta}
        </span>
      </div>
      {subject && !isMobile ? (
        <span data-chip="subject" className={cn(chip, "max-w-40 shrink-0 truncate")}>
          {subject.name.split(" — ")[0]}
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Opções de ${row.title}`} className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-y-1 after:inset-x-0">
            <EllipsisIcon strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <PencilIcon strokeWidth={1.75} /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleDone}>
            {done ? <RotateCcwIcon strokeWidth={1.75} /> : <CheckIcon strokeWidth={1.75} />} {done ? "Reabrir" : "Marcar como concluído"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete}>
            <Trash2Icon strokeWidth={1.75} /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

// ------------------------------------------------------------------ month calendar

function CalendarCard({ deadlines, metas, today, month, onMonth, onPick, className }: { deadlines: DeadlineRow[]; metas: DeadlineMetaMap; today: string; month: string; onMonth: (month: string) => void; onPick: (row: DeadlineRow) => void; className?: string }) {
  const cells = monthCells(month)
  const byDay = new Map<string, DeadlineRow[]>()
  for (const d of deadlines) byDay.set(d.due_on, [...(byDay.get(d.due_on) ?? []), d])
  const nav = "relative flex size-8 items-center justify-center rounded-full border border-border outline-none transition-colors duration-[400ms] after:absolute after:-inset-1.5 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
  return (
    <BentoCard
      title={capitalize(monthTitle(month))}
      data-testid="deadline-calendar"
      className={className}
      actions={
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Mês anterior" data-testid="month-prev" onClick={() => onMonth(shiftMonth(month, -1))} className={nav}>
            <ChevronLeftIcon aria-hidden strokeWidth={1.75} className="size-4" />
          </button>
          <button type="button" aria-label="Próximo mês" data-testid="month-next" onClick={() => onMonth(shiftMonth(month, 1))} className={nav}>
            <ChevronRightIcon aria-hidden strokeWidth={1.75} className="size-4" />
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-1">
        {LETTERS.map((l, i) => (
          <span key={i} aria-hidden className="text-center text-[12px] leading-5 text-muted-foreground">
            {l}
          </span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`b${i}`} aria-hidden />
          const list = byDay.get(day) ?? []
          const open = list.filter((d) => !metas[d.id]?.done)
          const isDeadline = list.length > 0
          const isToday = day === today
          const past = day < today
          const label = `${formatShort(day)}${isToday ? ", hoje" : ""}${isDeadline ? `: ${list.map((d) => d.title).join(", ")}` : ""}`
          const base = cn("tabular flex h-11 items-center justify-center rounded-[10px] text-[14px] leading-5 md:h-10", isToday && (isDeadline ? "ring-2 ring-highlight-foreground ring-inset" : "ring-2 ring-primary ring-inset"), past && !isDeadline && "text-muted-foreground/50")
          if (isDeadline) {
            return (
              <button key={day} type="button" data-cal-deadline={day} aria-label={label} onClick={() => onPick(open[0] ?? list[0])} className={cn(base, "bg-highlight font-semibold text-highlight-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50", past && "opacity-50")}>
                {Number(day.slice(8))}
              </button>
            )
          }
          return (
            <span key={day} aria-label={label} data-cal-day={day} className={cn(base, isToday && "font-semibold")}>
              {Number(day.slice(8))}
            </span>
          )
        })}
      </div>
      <div className="flex items-center gap-4 pt-1 text-[12px] leading-4 text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[4px] bg-highlight" /> prazo
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[4px] ring-2 ring-primary ring-inset" /> hoje
        </span>
      </div>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ the tab

export function ProvasTab({ deadlines, subjects, metas, today, isMobile, onQuick, onEdit, onToggleDone, onDelete }: Props) {
  const groups = groupDeadlines(deadlines, metas, today)
  const next = nextDeadline(deadlines, metas, today)
  const [openGroups, setOpenGroups] = useState<Partial<Record<GroupId, boolean>>>({})
  const [month, setMonth] = useState(today.slice(0, 7))
  const [highlight, setHighlight] = useState<string | null>(null)
  const [removing, setRemoving] = useState<DeadlineRow | null>(null)
  const isOpen = (id: GroupId) => openGroups[id] ?? id !== "done"

  useEffect(() => {
    if (!highlight) return
    const timer = window.setTimeout(() => setHighlight(null), 2200)
    return () => window.clearTimeout(timer)
  }, [highlight])

  function pick(row: DeadlineRow) {
    const done = Boolean(metas[row.id]?.done)
    if (done) setOpenGroups((g) => ({ ...g, done: true }))
    setHighlight(row.id)
    // After the group has opened, bring the row into view (no animation when the person prefers reduced motion).
    window.setTimeout(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      document.getElementById(`deadline-${row.id}`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" })
    }, 60)
  }

  const nextLeft = next ? daysLeft(next.due_on, today) : null
  const hero = (
    <HeroCard
      className="min-h-[208px]"
      label="Próximo prazo"
      value={nextLeft === null ? "—" : nextLeft === 0 ? "hoje" : <>{nextLeft} {dim(nextLeft === 1 ? "dia" : "dias")}</>}
      support={next ? `${next.title} · ${formatLong(next.due_on)}` : "Nenhum prazo à vista"}
      actions={
        <Button type="button" data-testid="next-edit" onClick={() => (next ? onEdit(next) : onQuick(""))} className="mt-auto h-10 w-fit rounded-full bg-highlight-foreground px-5 text-highlight hover:bg-highlight-foreground/90">
          {next ? <PencilIcon strokeWidth={1.75} /> : null}
          {next ? "Editar" : "Novo prazo"}
        </Button>
      }
    />
  )

  const list = (
    <div data-testid="deadline-groups" className="flex min-w-0 flex-col gap-2">
      {groups.length === 0 ? (
        <div data-testid="no-deadlines" className="flex flex-col items-center gap-2 rounded-[20px] border border-border p-8 text-center">
          <p className="text-[15px] leading-6 font-medium">Nenhuma prova ou prazo ainda</p>
          <p className="max-w-72 text-[13px] leading-5 text-muted-foreground">Digite acima, por exemplo “Prova de Cálculo, 20 de nov”, e a data já vem preenchida.</p>
        </div>
      ) : null}
      {groups.map((group) => (
        <section key={group.id} data-group={group.id} aria-label={group.label} className="flex flex-col">
          <GroupHeader label={group.label} count={group.items.length} open={isOpen(group.id)} onToggle={() => setOpenGroups((g) => ({ ...g, [group.id]: !isOpen(group.id) }))} />
          <Collapse open={isOpen(group.id)}>
            <ul className="flex flex-col gap-2 pb-2">
              {group.items.map((row) => (
                <DeadlineItem key={row.id} row={row} type={typeOf(row, metas[row.id])} subject={subjects.find((s) => s.id === row.subject_id)} done={Boolean(metas[row.id]?.done)} today={today} highlighted={highlight === row.id} isMobile={isMobile} onEdit={() => onEdit(row)} onToggleDone={() => onToggleDone(row)} onDelete={() => setRemoving(row)} />
              ))}
            </ul>
          </Collapse>
        </section>
      ))}
    </div>
  )

  const calendar = <CalendarCard deadlines={deadlines} metas={metas} today={today} month={month} onMonth={setMonth} onPick={pick} />

  return (
    <div data-testid="estudos-provas" className="@container flex min-w-0 flex-col gap-4">
      <QuickAdd label="Nova prova ou prazo… ex.: Prova de Cálculo, 20 de nov" shortLabel="Nova prova ou prazo…" ariaLabel="Nova prova ou prazo" isMobile={isMobile} onSubmit={onQuick} />
      {isMobile ? (
        // Phone order: pill, next deadline, list, calendar.
        <>
          {hero}
          {list}
          {calendar}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
          <div className="min-w-0 @min-[880px]:col-span-8">{list}</div>
          <div className="flex min-w-0 flex-col gap-4 @min-[880px]:col-span-4">
            {hero}
            {calendar}
          </div>
        </div>
      )}
      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este prazo?</AlertDialogTitle>
            <AlertDialogDescription>{removing ? `“${removing.title}” (${formatLong(removing.due_on)}) será removido.` : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) onDelete(removing)
                setRemoving(null)
              }}
            >
              <Trash2Icon strokeWidth={1.75} /> Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
