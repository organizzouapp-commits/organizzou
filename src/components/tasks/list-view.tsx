"use client"

import { useEffect, useState } from "react"
import { ChevronDownIcon, PlusIcon, SquareCheckIcon } from "lucide-react"

import { cardHover } from "@/components/organizzou/Bento"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { Button } from "@/components/ui/button"
import { groupByDue } from "@/features/tasks/view"
import { PRIORITY_LABELS, type ListRow, type Priority, type TaskView } from "@/features/tasks/types"
import { cn } from "@/lib/utils"

import { ListMenu, ListName } from "./list-parts"
import { QuickAdd } from "./quick-add"
import { TaskCardBody } from "./task-card"
import type { ViewProps } from "./types"

export type GroupBy = "lista" | "prazo" | "prioridade"

const STORAGE_KEY = "organizzou:tarefas-groups"
const FOLDED_BY_DEFAULT = new Set(["concluidas"])

function readFolded(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

const PRIORITY_ORDER: Priority[] = ["high", "medium", "low", "none"]

function Row({ task, props }: { task: TaskView; props: ViewProps }) {
  return (
    <TaskCardBody
      density="row"
      anchor
      task={task}
      tags={props.tags}
      now={props.now}
      timeZone={props.timeZone}
      actions={props.actionsFor(task)}
      selecting={props.selection.active}
      selected={props.selection.ids.has(task.id)}
      onSelect={() => props.selection.toggle(task.id)}
    />
  )
}

function Chevron({ open }: { open: boolean }) {
  return <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-[400ms] motion-reduce:transition-none", !open && "-rotate-90")} />
}

const countPill = "tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[12px] leading-4 font-medium"
const overline = "text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase"

/** One group per list of the quadro: the same lists, order and collapsed state as the Kanban. */
function ListGroup({ list, index, total, tasks, props }: { list: ListRow; index: number; total: number; tasks: TaskView[]; props: ViewProps }) {
  const [editing, setEditing] = useState(false)
  const [signal, setSignal] = useState(0)
  const open = !props.collapsed(list)
  return (
    <section data-group={list.id} aria-label={list.name} className="flex flex-col gap-1">
      <div className="-ml-2 flex min-h-11 items-center gap-1 rounded-xl pl-1">
        <button type="button" aria-expanded={open} aria-label={`${open ? "Recolher" : "Expandir"} ${list.name}`} onClick={() => props.onToggleCollapse(list)} className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50", cardHover)}>
          <Chevron open={open} />
        </button>
        <ListName list={list} actions={props} editing={editing} onEditingChange={setEditing} className="min-w-0" />
        <span className={countPill}>{tasks.length}</span>
        <Button variant="ghost" size="icon" aria-label={`Adicionar tarefa em ${list.name}`} className="size-11 rounded-full md:size-9" onClick={() => (open ? setSignal((n) => n + 1) : props.onToggleCollapse(list))}>
          <PlusIcon strokeWidth={1.75} />
        </Button>
        <ListMenu list={list} index={index} total={total} count={tasks.length} actions={props} onRename={() => setEditing(true)} />
      </div>
      {open ? (
        <div className="overflow-hidden rounded-[16px] border border-border bg-card">
          {tasks.map((task) => (
            <Row key={task.id} task={task} props={props} />
          ))}
          {tasks.length === 0 ? <p className="px-4 py-4 text-[13px] leading-5 text-muted-foreground">Nada em {list.name}.</p> : null}
          <div className="border-t border-border p-1.5">
            <QuickAdd onAdd={(title) => props.onQuickAdd(list.id, title)} openSignal={signal} />
          </div>
        </div>
      ) : null}
    </section>
  )
}

/**
 * Lista. Default grouping = the quadro's lists (same as the Kanban, collapse/reorder/rename shared); "Agrupar por" can switch to
 * Prazo (Atrasadas, Hoje, Amanhã…) or Prioridade. Headers: chevron, name, count, "+" and the ⋯ menu for lists.
 */
export function ListView(props: ViewProps & { groupBy: GroupBy }) {
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  useEffect(() => {
    // localStorage only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFolded(readFolded())
  }, [])
  const isFolded = (id: string) => folded[id] ?? FOLDED_BY_DEFAULT.has(id)
  function toggle(id: string) {
    const next = { ...folded, [id]: !isFolded(id) }
    setFolded(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  }

  const byList = props.groupBy === "lista"
  const groups =
    props.groupBy === "prazo"
      ? groupByDue(props.tasks, { now: props.now, timeZone: props.timeZone }).map((g) => ({ id: g.id as string, label: g.label, tasks: g.tasks }))
      : props.groupBy === "prioridade"
        ? PRIORITY_ORDER.map((p) => ({ id: `p-${p}`, label: PRIORITY_LABELS[p], tasks: props.tasks.filter((t) => t.priority === p) })).filter((g) => g.tasks.length > 0)
        : []

  return (
    <div className="flex flex-col gap-4">
      {byList && props.lists.length === 0 ? (
        <EmptyState
          icon={SquareCheckIcon}
          title="Nenhuma lista por aqui"
          description="Crie a primeira lista deste quadro."
          action={
            <Button type="button" className="h-11 rounded-full px-5" onClick={() => void props.onAddList("A fazer")}>
              <PlusIcon strokeWidth={1.75} /> Criar lista
            </Button>
          }
        />
      ) : null}
      {byList
        ? props.lists.map((list, i) => <ListGroup key={list.id} list={list} index={i} total={props.lists.length} tasks={props.tasks.filter((t) => t.list_id === list.id)} props={props} />)
        : groups.map((group) => {
            const open = !isFolded(group.id)
            return (
              <section key={group.id} data-group={group.id} aria-label={group.label} className="flex flex-col gap-1">
                <button type="button" aria-expanded={open} onClick={() => toggle(group.id)} className={cn("-ml-2 flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left", cardHover)}>
                  <Chevron open={open} />
                  <h3 className={overline}>{group.label}</h3>
                  <span className={countPill}>{group.tasks.length}</span>
                </button>
                {open ? (
                  <div className="overflow-hidden rounded-[16px] border border-border bg-card">
                    {group.tasks.map((task) => (
                      <Row key={task.id} task={task} props={props} />
                    ))}
                  </div>
                ) : null}
              </section>
            )
          })}
      {!byList && groups.length === 0 ? <EmptyState icon={SquareCheckIcon} title="Nenhuma tarefa por aqui" description="Adicione a primeira tarefa." /> : null}
    </div>
  )
}
