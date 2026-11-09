"use client"

import { useState } from "react"
import { BellIcon, CalendarCheckIcon, CheckCheckIcon, CheckIcon, ClockIcon, EllipsisIcon, PencilIcon, RotateCcwIcon, Trash2Icon, type LucideIcon } from "lucide-react"

import { BentoStat } from "@/components/finance/bento"
import { HeroCard, LIST_CARD } from "@/components/finance/parts"
import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { QuickAdd } from "@/components/organizzou/quick-add"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { REPEAT_OPTIONS, clockLabel, doneThisWeek, groupReminders, longDay, mostOverdue, reminderMeta, upcomingLabel, type ReminderGroupId, type ReminderMetaMap } from "@/features/notes/reminders"
import type { ReminderRow } from "@/features/notes/types"
import { cn } from "@/lib/utils"

const chip = "tabular inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"

export type LembretesProps = {
  reminders: ReminderRow[]
  metas: ReminderMetaMap
  now: Date
  isMobile: boolean
  onQuick: (text: string) => void
  onEdit: (row: ReminderRow) => void
  onReschedule: (row: ReminderRow) => void
  onRescheduleOverdue: () => void
  onToggle: (row: ReminderRow) => void
  onDelete: (row: ReminderRow) => void
  onClearDone: () => void
}

const GROUP_TITLES: Record<ReminderGroupId, string> = { overdue: "Atrasados", today: "Hoje", later: "Mais tarde", done: "Concluídos" }
const GROUP_EMPTY: Record<ReminderGroupId, string> = { overdue: "Nenhum lembrete atrasado.", today: "Nada marcado para hoje.", later: "Nada agendado para depois.", done: "Nenhum lembrete concluído ainda." }

/** The line that says how reminders reach the person. */
export function InfoLine({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-[13px] leading-5 text-muted-foreground", className)}>
      <BellIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
      Os lembretes avisam você pelo app, no horário marcado.
    </p>
  )
}

// ------------------------------------------------------------------ one row

function ReminderItem({ row, meta, now, done, onToggle, onEdit, onReschedule, onDelete }: { row: ReminderRow; meta: ReminderMetaMap[string] | undefined; now: Date; done: boolean; onToggle: () => void; onEdit: () => void; onReschedule: () => void; onDelete: () => void }) {
  const repeat = REPEAT_OPTIONS.find((o) => o.value === meta?.repeat && o.value !== "none")
  return (
    <li data-reminder={row.id} data-done={done} className={cn(LIST_CARD, "flex min-h-16 items-center gap-1 py-1.5 pr-1 pl-1")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Reabrir lembrete ${row.title}` : `Concluir lembrete ${row.title}`}
        data-testid="reminder-check"
        onClick={onToggle}
        className="group relative flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span aria-hidden className={cn("flex size-6 items-center justify-center rounded-full border-2 transition-colors duration-[400ms] motion-reduce:transition-none", done ? "border-highlight bg-highlight text-highlight-foreground" : "border-foreground/40 group-hover:border-foreground/70")}>
          {done ? <CheckIcon strokeWidth={2.5} className="size-3.5" /> : null}
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <span className={cn("text-[14px] leading-5 font-semibold break-words", done && "text-muted-foreground line-through")}>{row.title}</span>
        <span className="tabular text-[13px] leading-5 break-words text-muted-foreground">
          {reminderMeta(row.remind_at, now)}
          {repeat ? ` · ${repeat.label.toLowerCase()}` : ""}
        </span>
      </div>
      <span data-chip className={chip}>
        {done ? <CheckIcon aria-hidden strokeWidth={2} className="size-3" /> : <BellIcon aria-hidden strokeWidth={1.75} className="size-3" />}
        {done ? "Feito" : "App"}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Mais opções de ${row.title}`} className="size-11 shrink-0 rounded-full">
            <EllipsisIcon strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11" onSelect={onEdit}>
            <PencilIcon strokeWidth={1.75} /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={onReschedule}>
            <RotateCcwIcon strokeWidth={1.75} /> Reagendar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-11" onSelect={onDelete}>
            <Trash2Icon strokeWidth={1.75} /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

// ------------------------------------------------------------------ the tab

export function LembretesTab(props: LembretesProps) {
  const { reminders, metas, now, isMobile } = props
  const groups = groupReminders(reminders, now)
  const oldest = mostOverdue(reminders, now)
  const [closed, setClosed] = useState<Partial<Record<ReminderGroupId, boolean>>>({ done: true })
  const [removing, setRemoving] = useState<ReminderRow | null>(null)
  const [clearing, setClearing] = useState(false)

  const item = (row: ReminderRow) => (
    <ReminderItem key={row.id} row={row} meta={metas[row.id]} now={now} done={row.status === "done"} onToggle={() => props.onToggle(row)} onEdit={() => props.onEdit(row)} onReschedule={() => props.onReschedule(row)} onDelete={() => setRemoving(row)} />
  )

  const hero = (
    <HeroCard
      className={isMobile ? "h-[212px]" : "h-[216px]"}
      label="Atrasados"
      value={
        <>
          {groups.overdue.length} <span className="text-[16px] leading-6 opacity-60">{groups.overdue.length === 1 ? "lembrete" : "lembretes"}</span>
        </>
      }
      support={oldest ? `o mais antigo é de ${longDay(oldest)}` : "Nada atrasado"}
      actions={
        groups.overdue.length > 0 ? (
          <Button type="button" data-testid="reschedule-all" onClick={props.onRescheduleOverdue} className="mt-auto h-10 w-fit rounded-full bg-highlight-foreground px-5 text-highlight hover:bg-highlight-foreground/90">
            Reagendar
          </Button>
        ) : (
          <span className="mt-auto inline-flex h-10 items-center gap-2 text-[14px] font-semibold">
            <CheckCheckIcon aria-hidden strokeWidth={1.75} className="size-4" /> Tudo em dia
          </span>
        )
      }
    />
  )

  const stat = (label: string, icon: LucideIcon, value: number, chipText: string) => (
    <BentoStat key={label} label={label} icon={icon} className="h-[216px]" chip={chipText}>
      {value}
    </BentoStat>
  )

  const quick = <QuickAdd label="Novo lembrete… ex.: Pagar boleto amanhã às 9h" shortLabel="Novo lembrete…" ariaLabel="Novo lembrete" isMobile={isMobile} onSubmit={props.onQuick} />
  const dialogs = (
    <>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Excluir este lembrete?"
        description={removing ? `“${removing.title}” será apagado. Essa ação não pode ser desfeita.` : ""}
        onConfirm={() => {
          if (removing) props.onDelete(removing)
          setRemoving(null)
        }}
      />
      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title="Limpar os concluídos?"
        description={`${groups.done.length} ${groups.done.length === 1 ? "lembrete concluído será apagado" : "lembretes concluídos serão apagados"}. Essa ação não pode ser desfeita.`}
        confirmLabel="Limpar"
        onConfirm={() => {
          props.onClearDone()
          setClearing(false)
        }}
      />
    </>
  )

  if (isMobile) {
    const order: ReminderGroupId[] = ["overdue", "today", "later", "done"]
    return (
      <div data-testid="lembretes-tab" className="flex min-w-0 flex-col gap-3">
        {quick}
        <InfoLine />
        {hero}
        <div className="flex flex-col gap-1">
          {order
            .filter((id) => id === "today" || groups[id].length > 0)
            .map((id) => {
              const open = !closed[id]
              return (
                <section key={id} data-group={id} aria-label={GROUP_TITLES[id]} className="flex flex-col">
                  <GroupHeader label={GROUP_TITLES[id]} count={groups[id].length} open={open} onToggle={() => setClosed((s) => ({ ...s, [id]: open }))} />
                  <Collapse open={open}>
                    {groups[id].length === 0 ? (
                      <div data-testid="today-empty" className={cn(LIST_CARD, "mb-2 flex min-h-14 items-center px-4 text-[14px] text-muted-foreground")}>
                        {GROUP_EMPTY[id]}
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-2 pb-2">{groups[id].map(item)}</ul>
                    )}
                  </Collapse>
                </section>
              )
            })}
        </div>
        {dialogs}
      </div>
    )
  }

  const columns: ReminderGroupId[] = groups.today.length > 0 ? ["overdue", "today", "later", "done"] : ["overdue", "later", "done"]
  return (
    <div data-testid="lembretes-tab" className="@container flex min-w-0 flex-col gap-4">
      {quick}
      <div data-testid="reminder-summary" className="grid grid-cols-2 gap-4 @min-[1000px]:grid-cols-4">
        {[
          hero,
          stat("Hoje", CalendarCheckIcon, groups.today.length, groups.today.length === 0 ? "nada marcado" : `próximo: ${clockLabel(groups.today[0].remind_at)}`),
          stat("Mais tarde", ClockIcon, groups.later.length, groups.later.length === 0 ? "nada agendado" : `próximo: ${upcomingLabel(groups.later[0].remind_at, now)}`),
          stat("Concluídos", CheckCheckIcon, doneThisWeek(reminders, now), "esta semana"),
        ].map((card, i) => (
          <div key={i} className="flex min-w-0 flex-col [&>*]:flex-1">
            {card}
          </div>
        ))}
      </div>
      <div data-testid="reminder-columns" className={cn("grid grid-cols-1 gap-4 @min-[720px]:grid-cols-2", columns.length === 4 ? "@min-[1100px]:grid-cols-4" : "@min-[1000px]:grid-cols-3")}>
        {columns.map((id) => (
          <section key={id} data-group={id} aria-label={GROUP_TITLES[id]} className="flex h-[400px] min-w-0 flex-col gap-3 rounded-[20px] border border-border bg-card p-4">
            <div className="flex min-h-9 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-[17px] leading-6 font-semibold">{GROUP_TITLES[id]}</h3>
                <span data-chip className={chip}>
                  {groups[id].length}
                </span>
              </div>
              {id === "done" && groups.done.length > 0 ? (
                <Button type="button" variant="outline" data-testid="clear-done" onClick={() => setClearing(true)} className="h-9 rounded-full px-4">
                  Limpar
                </Button>
              ) : null}
            </div>
            {groups[id].length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">{GROUP_EMPTY[id]}</p> : <ul className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">{groups[id].map(item)}</ul>}
          </section>
        ))}
      </div>
      {dialogs}
    </div>
  )
}
