"use client"

import { useState } from "react"
import { CalendarClockIcon, EllipsisIcon, FlagIcon, PlusIcon, TargetIcon, TrophyIcon } from "lucide-react"
import { toast } from "sonner"

import { BentoStat } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { HatchedProgress, HeroCard } from "@/components/finance/parts"
import { GoalCard } from "@/components/goals/goal-card"
import { GoalSheet, type GoalDraft } from "@/components/goals/goal-sheet"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import type { ModuleId } from "@/components/organizzou/modules"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useIsMobile } from "@/hooks/use-mobile"
import { averageProgress, cappedPercent, milestoneTotals, nextDeadlineGoal, sortGoals } from "@/features/goals/overview"
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

type TabId = "ativas" | "concluidas"
const dim = (text: string) => <span className="text-[16px] leading-6 opacity-60">{text}</span>

/** The goal row itself, without the nested links and milestones (those are their own tables). */
const plain = (g: GoalWithDetails): LifeGoalRow => ({ id: g.id, user_id: g.user_id, title: g.title, description: g.description, deadline: g.deadline, status: g.status, created_at: g.created_at, updated_at: g.updated_at })

export function MetasScreen({ nowIso, initial }: { nowIso: string; initial: GoalWithDetails[] }) {
  const today = dayOf(nowIso)
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<TabId>("ativas")
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

  const tabs = (
    <PillTabs
      className={isMobile ? "w-full" : "w-fit max-w-full"}
      ariaLabel="Metas"
      items={[
        { id: "ativas", label: "Em andamento", count: active.length },
        { id: "concluidas", label: "Concluídas", count: done.length },
      ]}
      value={tab}
      onSelect={(item) => setTab(item.id as TabId)}
    />
  )

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

  const list = tab === "ativas" ? active : done
  const goalCards = (
    <div data-testid="goal-grid" className="grid grid-cols-1 items-stretch gap-4 @min-[880px]:grid-cols-2">
      {list.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          today={today}
          mobile={isMobile}
          onEdit={() => setDraft({ id: goal.id, title: goal.title, description: goal.description ?? "", deadline: goal.deadline ?? "", modules: [] })}
          onSetStatus={(status) => setStatus(goal, status)}
          onDelete={() => setToDelete(goal)}
          onToggleMilestone={(id) => toggleMilestone(goal.id, id)}
          onAddMilestone={(title) => addMilestone(goal.id, title)}
        />
      ))}
    </div>
  )

  return (
    <div className="@container flex min-w-0 flex-col gap-4" data-testid="metas" data-tab={tab}>
      <PageHeader />

      {isMobile ? (
        <section aria-label="Metas" data-testid="metas-header-block" className="mt-3 flex flex-col gap-2 rounded-[20px] border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[18px] leading-6 font-semibold">Metas</h2>
              <p className="truncate text-[13px] leading-5 text-muted-foreground">Objetivos alimentados pelos seus módulos.</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Opções de metas" data-testid="metas-options" className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-1">
                  <EllipsisIcon strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDraft(blankDraft())}>
                  <PlusIcon strokeWidth={1.75} /> Nova meta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {tabs}
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {tabs}
          <Button type="button" data-testid="new-goal" onClick={() => setDraft(blankDraft())} className="h-9 rounded-full bg-highlight px-4 text-highlight-foreground hover:bg-highlight/90">
            <PlusIcon strokeWidth={1.75} /> Nova meta
          </Button>
        </div>
      )}

      {isMobile ? (
        <FinanceDeck title={null} label="Resumo das metas" noun="resumo" initialHeight={200} slides={[{ id: "hero", hero: true, node: hero }, { id: "done", node: closed }, { id: "next", node: deadline }, { id: "marcos", node: milestones }]} />
      ) : (
        <div data-testid="goals-summary" className="grid grid-cols-2 gap-4 @min-[880px]:grid-cols-4">
          {[hero, closed, deadline, milestones].map((card, i) => (
            <div key={i} className="flex min-w-0 flex-col [&>*]:flex-1">
              {card}
            </div>
          ))}
        </div>
      )}

      {list.length > 0 ? (
        goalCards
      ) : tab === "ativas" ? (
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
      ) : (
        <p data-testid="done-empty" className="py-6 text-[15px] leading-6 text-muted-foreground">
          Nenhuma meta concluída ainda.
        </p>
      )}

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
