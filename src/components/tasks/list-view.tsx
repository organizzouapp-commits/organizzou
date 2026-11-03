"use client"

import { useEffect, useState } from "react"
import { ChevronDownIcon, PlusIcon, SquareCheckIcon } from "lucide-react"

import { cardHover } from "@/components/organizzou/Bento"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { Button } from "@/components/ui/button"
import { groupByDue, type DueGroupId } from "@/features/tasks/view"
import { cn } from "@/lib/utils"

import { TaskCardBody } from "./task-card"
import type { ViewProps } from "./types"

const STORAGE_KEY = "organizzou:tarefas-groups"
/** Folded by default: the person has finished these. */
const DEFAULT_FOLDED: Partial<Record<DueGroupId, boolean>> = { concluidas: true }

function readFolded(): Partial<Record<DueGroupId, boolean>> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<Record<DueGroupId, boolean>>) : {}
  } catch {
    return {}
  }
}

/**
 * Lista: grouped by due date (Atrasadas, Hoje, Amanhã, Esta semana, Mais tarde, Sem data, Concluídas). Headers look like "Seu dia":
 * overline, chevron on the left, ONE count, nothing else when folded; the choice is remembered. Each group is one card with
 * hairline dividers.
 */
export function ListView(props: ViewProps) {
  const [folded, setFolded] = useState<Partial<Record<DueGroupId, boolean>>>({})
  useEffect(() => {
    // localStorage only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFolded(readFolded())
  }, [])
  const isFolded = (id: DueGroupId) => folded[id] ?? DEFAULT_FOLDED[id] ?? false
  function toggle(id: DueGroupId) {
    const next = { ...folded, [id]: !isFolded(id) }
    setFolded(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  }

  const context = { now: props.now, timeZone: props.timeZone }
  const groups = groupByDue(props.tasks, context)

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => props.onCreate()}
        className="flex min-h-11 items-center gap-2 rounded-[14px] border border-dashed border-border bg-card px-4 text-[15px] text-muted-foreground outline-none hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" /> Adicionar tarefa…
      </button>
      {groups.length === 0 ? (
        <EmptyState
          icon={SquareCheckIcon}
          title="Nenhuma tarefa por aqui"
          description="Adicione a primeira tarefa desta lista."
          action={
            <Button type="button" className="h-11 rounded-full px-5" onClick={() => props.onCreate()}>
              <PlusIcon strokeWidth={1.75} /> Adicionar tarefa
            </Button>
          }
        />
      ) : null}
      {groups.map((group) => {
        const open = !isFolded(group.id)
        return (
          <section key={group.id} data-group={group.id} aria-label={group.label} className="flex flex-col gap-1">
            <button type="button" aria-expanded={open} onClick={() => toggle(group.id)} className={cn("-ml-2 flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left", cardHover)}>
              <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-[400ms] motion-reduce:transition-none", !open && "-rotate-90")} />
              <h3 className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{group.label}</h3>
              <span className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[12px] leading-4 font-medium">{group.tasks.length}</span>
            </button>
            {open ? (
              <div className="overflow-hidden rounded-[16px] border border-border bg-card">
                {group.tasks.map((task) => (
                  <TaskCardBody
                    key={task.id}
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
                ))}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
