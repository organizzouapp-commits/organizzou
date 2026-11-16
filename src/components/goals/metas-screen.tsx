"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClockIcon, ChevronDownIcon, FlagIcon, PlusIcon, TargetIcon, TrophyIcon } from "lucide-react"
import { toast } from "sonner"

import { BentoStat } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { HatchedProgress, HeroCard } from "@/components/finance/parts"
import { DoneGoalCard, GoalCard } from "@/components/goals/goal-card"
import { GoalSheet, type GoalDraft, type GoalSave } from "@/components/goals/goal-sheet"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Button } from "@/components/ui/button"
import { useElementWidth } from "@/hooks/use-element-size"
import { useIsMobile } from "@/hooks/use-mobile"
import { splitColumns } from "@/lib/columns"
import { averageProgress, cappedPercent, completedOn, formatDeadline, localGoalMetaRepo, milestoneTotals, nextDeadlineGoal, sortGoals, type GoalMetaMap } from "@/features/goals/overview"
import { DEFAULT_VIEW, allCollapsed, isCollapsed, localGoalViewRepo, setAllCollapsed, toggleCollapsed, type GoalViewState } from "@/features/goals/view-state"
import type { GoalLinkRow, GoalMilestoneRow, GoalWithDetails, LifeGoalRow } from "@/features/goals/types"
import type { FinancialGoalRow } from "@/features/finance/types"
import { computeLinked, isLinkedComplete, localLinkedGoalRepo, MONEY_UNIT, type GoalSources, type LinkProgress, type LinkedGoalMap, type LinkedGoalMeta } from "@/features/goals/linked"
import { linkToColumns, mergeLinks } from "@/features/goals/link-columns"
import { localReviewLogRepo } from "@/features/studies/review"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import { dayOf, newId } from "@/lib/sp-time"

const USER = "00000000-0000-4000-8000-000000000001"

const dim = (text: string) => <span className="text-[16px] leading-6 opacity-60">{text}</span>

/** The goal row itself, without the nested links and milestones (those are their own tables). */
const plain = (g: GoalWithDetails): LifeGoalRow => ({ id: g.id, user_id: g.user_id, title: g.title, description: g.description, deadline: g.deadline, status: g.status, created_at: g.created_at, updated_at: g.updated_at, kind: g.kind, link_type: g.link_type, link_id: g.link_id, params: g.params, start_date: g.start_date, end_date: g.end_date })

/** A live progress row as a link row of the goal card (money comes in cents, the card shows reais). */
function asLinkRow(goalId: string, p: LinkProgress, index: number): GoalLinkRow {
  const money = p.unit === MONEY_UNIT
  return { id: `${goalId}-${index}`, goal_id: goalId, module: p.module, label: p.label, done: money ? p.done / 100 : p.done, total: money ? p.total / 100 : p.total, unit: p.unit, href: p.href, inverse: p.inverse, broken: p.broken }
}

export function MetasScreen({ nowIso, initial, sources }: { nowIso: string; initial: GoalWithDetails[]; sources: GoalSources }) {
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

  // Goals driven by the modules: the link of each goal (what it measures, target, dates) is kept on this device until the link columns exist
  // (see linked.ts); the progress itself is never stored, it is computed from the module rows the page loaded.
  const router = useRouter()
  // The link of each goal: the database columns when the migration is applied, this device otherwise (see link-columns.ts).
  const [localLinks, setLocalLinks] = useState<LinkedGoalMap>({})
  const [reviews, setReviews] = useState<{ reviewed_on: string }[]>([])
  // Finanças goals are the same records: Metas reads them (and creates one when a goal is born here), it never copies them.
  const [financeRows, setFinanceRows] = usePersistedRows<FinancialGoalRow>("finance_goals", () => sources.financeGoals as FinancialGoalRow[])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalLinks(localLinkedGoalRepo.load())
    setReviews(localReviewLogRepo.load())
  }, [])
  const updateLinks = (change: (current: LinkedGoalMap) => LinkedGoalMap) =>
    setLocalLinks((current) => {
      const next = change(current)
      localLinkedGoalRepo.save(next)
      return next
    })
  const links = useMemo(() => mergeLinks(goalRows, localLinks), [goalRows, localLinks])
  const liveSources: GoalSources = { ...sources, financeGoals: financeRows, reviews }

  /** The goals as shown: linked goals carry their live rows and finish by themselves at 100%; Finanças goals nobody linked appear as linked goals. */
  const shown = useMemo<GoalWithDetails[]>(() => {
    const decorate = (g: GoalWithDetails): GoalWithDetails => {
      const meta = links[g.id]
      if (!meta) return g
      const rows = computeLinked(meta, liveSources, today)
      return { ...g, links: rows.map((r, i) => asLinkRow(g.id, r, i)), status: g.status === "done" || isLinkedComplete(rows) ? "done" : "active", linked: { kind: meta.spec.kind, start: meta.startDate, end: meta.endDate, virtual: false } }
    }
    const taken = new Set(Object.values(links).flatMap((m) => (m.spec.kind === "finance_saving" ? [m.spec.goalId] : [])))
    const virtual: GoalWithDetails[] = financeRows
      .filter((g) => !taken.has(g.id))
      .map((g) => {
        const meta: LinkedGoalMeta = { spec: { kind: "finance_saving", goalId: g.id }, startDate: g.created_at.slice(0, 10), endDate: g.deadline }
        const rows = computeLinked(meta, liveSources, today)
        return { id: `fin-${g.id}`, user_id: g.user_id, title: g.name, description: null, deadline: g.deadline, status: isLinkedComplete(rows) ? "done" : "active", created_at: g.created_at, updated_at: g.updated_at, links: rows.map((r, i) => asLinkRow(`fin-${g.id}`, r, i)), milestones: [], linked: { kind: "finance_saving", start: meta.startDate, end: g.deadline, virtual: true } }
      })
    return [...goals.map(decorate), ...virtual]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, links, financeRows, sources, reviews, today])

  // A small celebration the first time a linked goal is seen complete (a toast; nothing moves, so reduced motion needs no special case).
  useEffect(() => {
    const finished = shown.filter((g) => g.linked && g.status === "done" && !(metas[g.id]?.completed_at))
    if (finished.length === 0) return
    let seen: string[] = []
    try {
      seen = JSON.parse(localStorage.getItem("organizzou:metas-celebrated") ?? "[]") as string[]
    } catch {
      seen = []
    }
    const fresh = finished.filter((g) => !seen.includes(g.id))
    if (fresh.length === 0) return
    for (const g of fresh) toast.success(`Meta concluída: ${g.title}. Parabéns!`)
    try {
      localStorage.setItem("organizzou:metas-celebrated", JSON.stringify([...seen, ...fresh.map((g) => g.id)].slice(-200)))
    } catch {
      // Private mode: it may celebrate again next time.
    }
  }, [shown, metas])

  const editDraftOf = (goal: GoalWithDetails): GoalDraft => ({ id: goal.id, title: goal.title, description: goal.description ?? "", deadline: goal.deadline ?? "", startDate: links[goal.id]?.startDate ?? goal.created_at.slice(0, 10), link: links[goal.id]?.spec ?? null })

  /** Virtual goals live in Finanças: editing or deleting them goes there, so there is only ever one record. */
  function editGoal(goal: GoalWithDetails) {
    if (goal.linked?.virtual) {
      toast("Esta meta é de Finanças. Edite por lá.")
      return router.push("/dashboard/financas")
    }
    setDraft(editDraftOf(goal))
  }

  function removeGoal(goal: GoalWithDetails) {
    if (goal.linked?.virtual) {
      toast("Esta meta é de Finanças. Exclua por lá.")
      return router.push("/dashboard/financas")
    }
    setGoals((current) => current.filter((g) => g.id !== goal.id))
    updateLinks((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== goal.id)))
    toast("Meta excluída.")
  }

  const blankDraft = (): GoalDraft => ({ title: "", description: "", deadline: "", startDate: today, link: null })
  usePrimaryAction("Nova meta", () => setDraft(blankDraft()))

  function toggleMilestone(goalId: string, milestoneId: string) {
    setGoals((current) => current.map((g) => (g.id === goalId ? { ...g, milestones: g.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m)) } : g)))
  }

  function addMilestone(goalId: string, title: string) {
    if (goalId.startsWith("fin-")) return toast("Metas de Finanças não têm marcos aqui.")
    setGoals((current) => current.map((g) => (g.id === goalId ? { ...g, milestones: [...g.milestones, { id: newId(), goal_id: goalId, title, done: false }] } : g)))
    toast.success("Marco adicionado.")
  }

  function setStatus(goal: GoalWithDetails, status: "active" | "done") {
    setGoals((current) => current.map((g) => (g.id === goal.id ? { ...g, status } : g)))
    // Closing a goal records the moment; reopening forgets it.
    updateMetas((current) => (status === "done" ? { ...current, [goal.id]: { completed_at: new Date().toISOString() } } : Object.fromEntries(Object.entries(current).filter(([id]) => id !== goal.id))))
    toast.success(status === "done" ? "Meta concluída. Parabéns!" : "Meta reaberta.")
  }

  function saveGoal(save: GoalSave) {
    const { built } = save
    const id = save.id ?? newId()
    if (built?.newFinance) {
      // A new savings goal born here is ONE Finanças record: the link points at it.
      const stamp = new Date().toISOString()
      setFinanceRows((current) => [...current, { id: (built.spec as { goalId: string }).goalId, user_id: USER, name: built.newFinance!.name, target_cents: built.newFinance!.targetCents, current_cents: 0, deadline: save.deadline || null, created_at: stamp, updated_at: stamp }])
    }
    // Saved in the goal's own columns (when the database has them) and on this device (always), so a goal never loses its link.
    const columns = linkToColumns(built ? { spec: built.spec, startDate: save.startDate, endDate: save.deadline || null } : undefined)
    updateLinks((current) => {
      const next = { ...current }
      if (built) next[id] = { spec: built.spec, startDate: save.startDate, endDate: save.deadline || null }
      else delete next[id]
      return next
    })
    if (save.id) {
      setGoals((current) => current.map((g) => (g.id === save.id ? { ...g, ...columns, title: save.title, description: save.description || null, deadline: save.deadline || null, updated_at: new Date().toISOString() } : g)))
      toast.success("Meta atualizada.")
      return
    }
    const created: GoalWithDetails = { id, user_id: USER, title: save.title, description: save.description || null, deadline: save.deadline || null, status: "active", created_at: nowIso, updated_at: nowIso, links: [], milestones: [], ...columns }
    setGoals((current) => [created, ...current])
    toast.success("Meta criada.")
  }

  const active = sortGoals(shown.filter((g) => g.status === "active"))
  const done = sortGoals(shown.filter((g) => g.status === "done"))
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
              onEdit={() => editGoal(goal)}
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
                    onEdit={() => editGoal(goal)}
                    onReopen={() => setStatus(goal, "active")}
                    onDelete={() => setToDelete(goal)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <GoalSheet draft={draft} today={today} sources={liveSources} onClose={() => setDraft(null)} onSave={saveGoal} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir esta meta?"
        description={toDelete ? `“${toDelete.title}” será apagada. Tarefas, hábitos e registros ligados a ela continuam existindo.` : ""}
        onConfirm={() => {
          const goal = toDelete
          setToDelete(null)
          if (goal) removeGoal(goal)
        }}
      />
    </div>
  )
}
