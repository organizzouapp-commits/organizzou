"use client"

import { CheckIcon, ChevronDownIcon, PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon, TrophyIcon } from "lucide-react"

import { HatchedProgress } from "@/components/finance/parts"
import { Button } from "@/components/ui/button"
import { ActionMenu, type ActionItem } from "@/components/organizzou/action-menu"
import { modules } from "@/components/organizzou/modules"
import { QuickAdd } from "@/components/organizzou/quick-add"
import { cappedPercent, deadlineChips, linkText, milestoneChip } from "@/features/goals/overview"
import { goalProgress } from "@/features/goals/progress"
import type { GoalMilestoneRow, GoalWithDetails } from "@/features/goals/types"
import { cn } from "@/lib/utils"

const chip = "tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const SMALL_CAPS = "text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase"

/** The progress ring of a goal: Lima stroke with round caps, the percentage in the middle with a dimmed "%". */
function GoalRing({ value, label, size }: { value: number; label: string; size: number }) {
  const pct = cappedPercent(value, 100)
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} data-testid="goal-ring" className="relative shrink-0 transition-[width,height] duration-[400ms] motion-reduce:transition-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" className="-rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ opacity: pct > 0 ? 1 : 0 }} />
      </svg>
      <span className={cn("tabular absolute inset-0 flex items-baseline justify-center font-semibold", size >= 90 ? "pt-[34%] text-[26px] leading-8" : size >= 70 ? "pt-[34%] text-[20px] leading-6" : "pt-[32%] text-[14px] leading-5")}>
        {pct}
        <span className={cn("opacity-60", size >= 90 ? "text-[14px]" : "text-[11px]")}>%</span>
      </span>
    </div>
  )
}

function MilestoneRow({ milestone, onToggle }: { milestone: GoalMilestoneRow; onToggle: () => void }) {
  return (
    <li data-milestone={milestone.id} data-done={milestone.done} className="flex min-h-11 items-center gap-1">
      <button type="button" role="checkbox" aria-checked={milestone.done} aria-label={milestone.done ? `Reabrir marco ${milestone.title}` : `Marcar marco ${milestone.title} como concluído`} onClick={onToggle} className="group relative flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span aria-hidden className={cn("flex size-6 items-center justify-center rounded-full border-2 transition-colors duration-[400ms] motion-reduce:transition-none", milestone.done ? "border-highlight bg-highlight text-highlight-foreground" : "border-foreground/40 group-hover:border-foreground/70")}>
          {milestone.done ? <CheckIcon strokeWidth={2.5} className="size-3.5" /> : null}
        </span>
      </button>
      <span className={cn("min-w-0 flex-1 py-1 text-[15px] leading-6 break-words", milestone.done && "text-muted-foreground line-through")}>{milestone.title}</span>
    </li>
  )
}

export type GoalCardProps = {
  goal: GoalWithDetails
  today: string
  mobile: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  onEdit: () => void
  onSetStatus: (status: "active" | "done") => void
  onDelete: () => void
  onToggleMilestone: (milestoneId: string) => void
  onAddMilestone: (title: string) => void
}

/**
 * A goal in progress. The chevron folds it to one compact row (small ring, title, chips and a thin hatched bar); the rest (description,
 * "Ligada a", "Marcos") slides away with an animated height (instant with reduced motion).
 */
export function GoalCard({ goal, today, mobile, collapsed, onToggleCollapsed, onEdit, onSetStatus, onDelete, onToggleMilestone, onAddMilestone }: GoalCardProps) {
  const progress = goalProgress(goal.links, goal.milestones)
  const chips = deadlineChips(goal.deadline, today, true)
  const doneMilestones = goal.milestones.filter((m) => m.done).length
  const inputId = `milestone-${goal.id}`
  const bodyId = `goal-body-${goal.id}`

  const items: ActionItem[] = [
    { label: "Editar meta", icon: PencilIcon, run: onEdit },
    { label: "Marcar como concluída", icon: CheckIcon, run: () => onSetStatus("done") },
    { label: "Adicionar marco", icon: PlusIcon, run: () => document.getElementById(inputId)?.focus() },
    { label: "Excluir meta", icon: Trash2Icon, run: onDelete, separated: true },
  ]

  return (
    <section aria-label={goal.title} data-goal={goal.id} data-status={goal.status} data-collapsed={collapsed} className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-border bg-card p-4 md:p-6">
      <div className="flex items-start gap-4">
        <GoalRing value={progress} label={`Progresso de ${goal.title}`} size={collapsed ? 56 : mobile ? 72 : 96} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-1">
            <h3 title={goal.title} className="line-clamp-2 min-w-0 text-[16px] leading-6 font-semibold break-words md:text-[18px] md:leading-7">
              {goal.title}
            </h3>
            <div className="-mt-2 -mr-2 flex shrink-0 items-center">
              <Button type="button" variant="ghost" aria-expanded={!collapsed} aria-controls={bodyId} aria-label={collapsed ? `Expandir ${goal.title}` : `Recolher ${goal.title}`} data-testid="goal-toggle" onClick={onToggleCollapsed} className="size-11 shrink-0 rounded-full p-0 md:size-11">
                <ChevronDownIcon strokeWidth={1.75} className={cn("transition-transform duration-[400ms] motion-reduce:transition-none", !collapsed && "rotate-180")} />
              </Button>
              <ActionMenu items={items} mobile={mobile} ariaLabel={`Opções de ${goal.title}`} title={goal.title} />
            </div>
          </div>
          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((text) => (
                <span key={text} data-chip className={chip}>
                  {text}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {collapsed ? <HatchedProgress value={progress} label={`Progresso de ${goal.title}: ${progress}%`} className="h-1.5" /> : null}

      {/* The folding part: a grid row that animates between 1fr and 0fr, so the height eases without measuring anything. */}
      <div id={bodyId} data-goal-body className={cn("grid transition-[grid-template-rows] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none", collapsed ? "-mt-4 grid-rows-[0fr]" : "grid-rows-[1fr]")} inert={collapsed}>
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          {goal.description ? <p className="text-[14px] leading-5 text-muted-foreground">{goal.description}</p> : null}

          {goal.links.length > 0 ? (
            <section aria-label="Ligada a" className="flex flex-col gap-3 border-t border-border pt-4">
              <h4 className={SMALL_CAPS}>Ligada a</h4>
              <ul className="flex flex-col gap-4">
                {goal.links.map((link) => {
                  const Icon = modules[link.module].icon
                  return (
                    <li key={link.id} data-link={link.id} className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-2">
                      <span aria-hidden className="row-span-2 flex size-9 items-center justify-center self-center rounded-full border border-border">
                        <Icon strokeWidth={1.75} className="size-4" />
                      </span>
                      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
                        <span className="min-w-0 text-[14px] leading-5 font-medium break-words">{link.label}</span>
                        <span className="tabular shrink-0 text-[13px] leading-5 text-muted-foreground">{linkText(link)}</span>
                      </div>
                      <HatchedProgress value={cappedPercent(link.done, link.total)} label={`${link.label}: ${linkText(link)}`} className="h-2" />
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <section aria-label="Marcos" className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className={SMALL_CAPS}>Marcos</h4>
              {goal.milestones.length > 0 ? (
                <span data-chip className={chip}>
                  {milestoneChip(doneMilestones, goal.milestones.length)}
                </span>
              ) : null}
            </div>
            {goal.milestones.length === 0 ? <p className="text-[14px] leading-5 text-muted-foreground">Quebre a meta em passos menores.</p> : null}
            <ul className="flex flex-col">
              {goal.milestones.map((m) => (
                <MilestoneRow key={m.id} milestone={m} onToggle={() => onToggleMilestone(m.id)} />
              ))}
            </ul>
            <QuickAdd inputId={inputId} label="Adicionar marco…" shortLabel="Adicionar marco…" ariaLabel={`Adicionar marco em ${goal.title}`} isMobile={mobile} onSubmit={(text) => text && onAddMilestone(text)} />
          </section>
        </div>
      </div>
    </section>
  )
}

/** A finished goal as a compact row: trophy, title, the day it was completed, and a "…" menu (reopen, edit, delete). */
export function DoneGoalCard({ goal, completedOn, mobile, onEdit, onReopen, onDelete }: { goal: GoalWithDetails; completedOn: string | null; mobile: boolean; onEdit: () => void; onReopen: () => void; onDelete: () => void }) {
  const items: ActionItem[] = [
    { label: "Reabrir meta", icon: RotateCcwIcon, run: onReopen },
    { label: "Editar meta", icon: PencilIcon, run: onEdit },
    { label: "Excluir meta", icon: Trash2Icon, run: onDelete, separated: true },
  ]
  return (
    <section aria-label={goal.title} data-goal={goal.id} data-status="done" className="flex min-w-0 items-center gap-4 rounded-[20px] border border-border bg-card p-4">
      <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border">
        <TrophyIcon strokeWidth={1.75} className="size-6" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 title={goal.title} className="line-clamp-2 text-[16px] leading-6 font-semibold break-words">
          {goal.title}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <span data-chip="done" className="tabular inline-flex h-6 items-center gap-1 rounded-full bg-highlight px-2 text-[12px] leading-4 font-semibold whitespace-nowrap text-highlight-foreground">
            <CheckIcon aria-hidden strokeWidth={2.5} className="size-3" /> Concluída
          </span>
          {completedOn ? (
            <span data-chip className={chip}>
              concluída em {completedOn}
            </span>
          ) : null}
        </div>
      </div>
      <ActionMenu items={items} mobile={mobile} ariaLabel={`Opções de ${goal.title}`} title={goal.title} className="-mr-2" />
    </section>
  )
}
