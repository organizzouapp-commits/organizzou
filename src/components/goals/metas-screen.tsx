"use client"

import { useEffect, useState } from "react"
import { CalendarClockIcon, ChevronDownIcon, FlagIcon, PlusIcon, TargetIcon, TrophyIcon } from "lucide-react"
import { toast } from "sonner"

import { BentoStat } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { HatchedProgress, HeroCard } from "@/components/finance/parts"
import { DoneGoalCard, GoalCard } from "@/components/goals/goal-card"
import { GoalSheet, type GoalDraft } from "@/components/goals/goal-sheet"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import type { ModuleId } from "@/components/organizzou/modules"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Button } from "@/components/ui/button"
import { useElementWidth } from "@/hooks/use-element-size"
import { useIsMobile } from "@/hooks/use-mobile"
import { splitColumns } from "@/lib/columns"
import { averageProgress, cappedPercent, completedOn, formatDeadline, localGoalMetaRepo, milestoneTotals, nextDeadlineGoal, sortGoals, type GoalMetaMap } from "@/features/goals/overview"
import { DEFAULT_VIEW, allCollapsed, isCollapsed, localGoalViewRepo, setAllCollapsed, toggleCollapsed, type GoalViewState } from "@/features/goals/view-state"
import type { GoalLinkRow, GoalMilestoneRow, GoalWithDetails, LifeGoalRow } from "@/features/goals/types"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import { dayOf, newId } from "@/lib/sp-time"

const USER = "00000000-0000-4000-8000-000000000001"
const DEFAULT_LINKS: Record<string, { label: string; total: number; unit: string }> = {
  tarefas: { label: "Tarefas concluídas", total: 10, unit: "tarefas" },
  rotina: { label: "Dias com o hábito em dia", total: 30, unit: "dias" },
  financas: { label: "Valor guardado", total: 1000, unit: "R$" },
  treinos: { label: "Treinos feitos", total: 20, unit: "treinos" },
  dieta: { label: "Dias dentro da meta", total: 30, unit: "dias" },
  estudos: { label: "Horas de estudo", total: 50, unit: "h" },
}

const dim = (text: string) => <span className="text-[16px] leading-6 opacity-60">{text}</span>

/** The goal row itself, without the nested links and milestones (those are their own tables). */
const plain = (g: GoalWithDetails): LifeGoalRow => ({ id: g.id, user_id: g.user_id, title: g.title, description: g.description, deadline: g.deadline, status: g.status, created_at: g.created_at, updated_at: g.updated_at })

export function MetasScreen({ nowIso, initial }: { nowIso: string; initial: GoalWithDetails[] }) {
  const today = dayOf(nowIso)
  const isMobile = useIsMobile()
  const [gridRef, gridWidth] = useElementWidth<HTMLDivElement>()
  // How the page is folded (collapsed cards, Concluídas open): a view preference kept on this device (see view-state.ts).
  const [view, setView] = useState<GoalViewState>(DEFAULT_VIEW)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(localGoalViewRepo.load())
  }, [])
  const updateView = (change: (current: GoalViewState) => GoalViewState) =>
    setView((current) => {
      const next = change(current)
      localGoalViewRepo.save(next)
      return next
    })
  // A goal is three tables (the goal, what feeds it, its milestones). The screen edits the nested shape; each table is saved on its own, parents first.
  const start = initial
  const [goalRows, setGoalRows] = usePersistedRows<LifeGoalRow>("life_goals", () => start.map(plain))
  const [linkRows, setLinkRows] = usePersistedRows<GoalLinkRow>("life_goal_links", () => start.flatMap((g) => g.links))
  const [milestoneRows, setMilestoneRows] = usePersistedRows<GoalMilestoneRow>("life_goal_milestones", () => start.flatMap((g) => g.milestones))
  const goals: GoalWithDetails[] = goalRows.map((g) => ({ ...g, links: linkRows.filter((l) => l.goal_id === g.id), milestones: milestoneRows.filter((m) => m.goal_id === g.id) }))
  const setGoals = (update: (current: GoalWithDetails[]) => GoalWithDetails[]) => {
    const next = update(goals)
    setGoalRows(next.map(plain))
    setLinkRows(next.flatMap((g) => g.links))
    setMilestoneRows(next.flatMap((g) => g.milestones))
  }
  const [draft, setDraft] = useState<GoalDraft | null>(null)
  const [toDelete, setToDelete] = useState<GoalWithDetails | null>(null)
  // When each goal was completed: localStorage until life_goals has a completed_at column (see overview.ts).
  const [metas, setMetas] = useState<GoalMetaMap>({})
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMetas(localGoalMetaRepo.load())
  }, [])
  const updateMetas = (change: (current: GoalMetaMap) => GoalMetaMap) =>
    setMetas((current) => {
      const next = change(current)
      localGoalMetaRepo.save(next)
      return next
    })

  const blankDraft = (): GoalDraft => ({ title: "", description: "", deadline: "", modules: ["tarefas"] })
  usePrimaryAction("Nova meta", () => setDraft(blankDraft()))

  function toggleMilestone(goalId: string, milestoneId: string) {
    setGoals((current) => current.map((g) => (g.id === goalId ? { ...g, milestones: g.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m)) } : g)))
  }

  function addMilestone(goalId: string, title: string) {
    setGoals((current) => current.map((g) => (g.id === goalId ? { ...g, milestones: [...g.milestones, { id: newId(), goal_id: goalId, title, done: false }] } : g)))
    toast.success("Marco adicionado.")
  }

  function setStatus(goal: GoalWithDetails, status: "active" | "done") {
    setGoals((current) => current.map((g) => (g.id === goal.id ? { ...g, status } : g)))
    // Closing a goal records the moment; reopening forgets it.
    updateMetas((current) => (status === "done" ? { ...current, [goal.id]: { completed_at: new Date().toISOString() } } : Object.fromEntries(Object.entries(current).filter(([id]) => id !== goal.id))))
    toast.success(status === "done" ? "Meta concluída. Parabéns!" : "Meta reaberta.")
  }

  function saveGoal(d: GoalDraft) {
    if (d.id) {
      setGoals((current) => current.map((g) => (g.id === d.id ? { ...g, title: d.title, description: d.description || null, deadline: d.deadline || null, updated_at: new Date().toISOString() } : g)))
      toast.success("Meta atualizada.")
      return
    }
    const id = newId()
    const created: GoalWithDetails = {
      id,
      user_id: USER,
      title: d.title,
      description: d.description || null,
      deadline: d.deadline || null,
      status: "active",
      created_at: nowIso,
      updated_at: nowIso,
      links: d.modules.map((module) => ({ id: newId(), goal_id: id, module: module as ModuleId, done: 0, ...DEFAULT_LINKS[module] })),
      milestones: [],
    }
    setGoals((current) => [created, ...current])
    toast.success("Meta criada.")
  }

  const active = sortGoals(goals.filter((g) => g.status === "active"))
  const done = sortGoals(goals.filter((g) => g.status === "done"))
  const average = averageProgress(active)
  const next = nextDeadlineGoal(active, today)
  const marcos = milestoneTotals(active)

  const height = isMobile ? "h-[200px]" : "h-48"
  const hero = (
    <HeroCard key="hero" className={height} density="dense" label="Em andamento" value={<>{active.length} {dim("metas")}</>} support={`${average}% de progresso médio`} progress={{ value: average, label: `Progresso médio: ${average}%` }} />
  )
  const closed = (
    <BentoStat key="done" label="Concluídas" icon={TrophyIcon} className={height} chip="metas fechadas">
      {done.length}
    </BentoStat>
  )
  const deadline = (
    <BentoStat key="next" label="Próximo prazo" icon={CalendarClockIcon} className={height} chip={next ? next.goal.title : "Sem prazos"}>
      {next ? (next.left === 0 ? "hoje" : <>{next.left} {dim(next.left === 1 ? "dia" : "dias")}</>) : "—"}
    </BentoStat>
  )
  const milestones = (
    <BentoStat key="marcos" label="Marcos" icon={FlagIcon} className={height} chip="concluídos" footer={<HatchedProgress value={cappedPercent(marcos.done, marcos.total)} label={`Marcos concluídos: ${marcos.done} de ${marcos.total}`} />}>
      {marcos.done} {dim(`de ${marcos.total}`)}
    </BentoStat>
  )

  const summary = [hero, closed, deadline, milestones]
  const slides = [
    { id: "hero", hero: true, node: hero },
    { id: "done", node: closed },
    { id: "next", node: deadline },
    { id: "marcos", node: milestones },
  ]

  // Goal cards in independent columns (dealt one by one) so a folded card never leaves a gap under its neighbour.
  const activeIds = active.map((g) => g.id)
  const everyFolded = allCollapsed(view, activeIds)
  const goalCards = (
    <div ref={gridRef} data-testid="goal-grid" className="flex items-start gap-4">
      {splitColumns(active, gridWidth >= 880 ? 2 : 1).map((column, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col gap-4">
          {column.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              today={today}
              mobile={isMobile}
              collapsed={isCollapsed(view, goal.id)}
              onToggleCollapsed={() => updateView((current) => toggleCollapsed(current, goal.id))}
              onEdit={() => setDraft({ id: goal.id, title: goal.title, description: goal.description ?? "", deadline: goal.deadline ?? "", modules: [] })}
              onSetStatus={(status) => setStatus(goal, status)}
              onDelete={() => setToDelete(goal)}
              onToggleMilestone={(id) => toggleMilestone(goal.id, id)}
              onAddMilestone={(title) => addMilestone(goal.id, title)}
            />
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <div className="@container flex min-w-0 flex-col gap-4" data-testid="metas">
      <PageHeader />

      {isMobile ? (
        <section aria-label="Metas" data-testid="metas-header-block" className="mt-3 rounded-[20px] border border-border bg-card p-3">
          <h2 className="truncate text-[18px] leading-6 font-semibold">Metas</h2>
          <p className="truncate text-[13px] leading-5 text-muted-foreground">Objetivos alimentados pelos seus módulos.</p>
        </section>
      ) : null}

      {isMobile ? (
        <FinanceDeck title={null} label="Resumo das metas" noun="resumo" initialHeight={200} slides={slides} />
      ) : (
        <div data-testid="goals-summary" className="grid grid-cols-2 gap-4 @min-[880px]:grid-cols-4">
          {summary.map((card, i) => (
            <div key={i} className="flex min-w-0 flex-col [&>*]:flex-1">
              {card}
            </div>
          ))}
        </div>
      )}

      <section aria-label="Em andamento" data-testid="goals-active" className="flex flex-col gap-3">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <h2 className="text-[17px] leading-6 font-semibold">
            Em andamento <span className="tabular text-muted-foreground">({active.length})</span>
          </h2>
          {active.length > 1 ? (
            <Button type="button" variant="ghost" data-testid="toggle-all" onClick={() => updateView((current) => setAllCollapsed(current, activeIds, !everyFolded))} className="h-11 rounded-full px-3 text-[13px] text-muted-foreground md:h-11">
              {everyFolded ? "Expandir todas" : "Recolher todas"}
            </Button>
          ) : null}
        </div>
        {active.length > 0 ? (
          goalCards
        ) : (
          <div data-testid="goals-empty" className="flex flex-col items-center gap-3 rounded-[20px] border border-border px-6 py-12 text-center">
            <span aria-hidden className="flex size-12 items-center justify-center rounded-full border border-border">
              <TargetIcon strokeWidth={1.75} className="size-5" />
            </span>
            <p className="text-[16px] leading-6 font-semibold">Nenhuma meta em andamento</p>
            <p className="max-w-72 text-[13px] leading-5 text-muted-foreground">Crie uma meta e ligue-a a Estudos, Treinos, Finanças e outros módulos.</p>
            <Button type="button" onClick={() => setDraft(blankDraft())} className="h-11 rounded-full bg-highlight px-5 text-highlight-foreground hover:bg-highlight/90">
              <PlusIcon strokeWidth={1.75} /> Nova meta
            </Button>
          </div>
        )}
      </section>

      <section aria-label="Concluídas" data-testid="goals-done" className="flex flex-col gap-3">
        <button type="button" aria-expanded={view.doneOpen} aria-controls="goals-done-list" data-testid="done-toggle" onClick={() => updateView((current) => ({ ...current, doneOpen: !current.doneOpen }))} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <h2 className="text-[17px] leading-6 font-semibold">
            Concluídas <span className="tabular text-muted-foreground">({done.length})</span>
          </h2>
          <ChevronDownIcon aria-hidden strokeWidth={1.75} className={`size-5 shrink-0 text-muted-foreground transition-transform duration-[400ms] motion-reduce:transition-none ${view.doneOpen ? "rotate-180" : ""}`} />
        </button>
        <div id="goals-done-list" className={`grid transition-[grid-template-rows] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${view.doneOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`} inert={!view.doneOpen}>
          <div className="min-h-0 overflow-hidden">
            {done.length === 0 ? (
              <p data-testid="done-empty" className="px-1 pb-2 text-[13px] leading-5 text-muted-foreground">
                Nenhuma meta concluída ainda. Quando você concluir uma, ela fica guardada aqui.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 pb-1 @min-[880px]:grid-cols-2">
                {done.map((goal) => (
                  <DoneGoalCard
                    key={goal.id}
                    goal={goal}
                    completedOn={formatDeadline(completedOn(goal, metas).day)}
                    mobile={isMobile}
                    onEdit={() => setDraft({ id: goal.id, title: goal.title, description: goal.description ?? "", deadline: goal.deadline ?? "", modules: [] })}
                    onReopen={() => setStatus(goal, "active")}
                    onDelete={() => setToDelete(goal)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <GoalSheet draft={draft} today={today} onClose={() => setDraft(null)} onSave={saveGoal} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir esta meta?"
        description={toDelete ? `“${toDelete.title}” será apagada. Tarefas, hábitos e registros ligados a ela continuam existindo.` : ""}
        onConfirm={() => {
          const goal = toDelete
          setToDelete(null)
          if (!goal) return
          setGoals((current) => current.filter((g) => g.id !== goal.id))
          toast("Meta excluída.")
        }}
      />
    </div>
  )
}
