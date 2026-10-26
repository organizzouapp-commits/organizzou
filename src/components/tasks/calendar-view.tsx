"use client"

import { useMemo, useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ListRow } from "@/components/organizzou/ListRow"
import { dayKey } from "@/lib/dates"
import { getSwatch } from "@/lib/swatches"
import { cn } from "@/lib/utils"
import type { TaskView } from "@/features/tasks/types"

import { DueLabel, PriorityIcon } from "./task-meta"
import type { ViewProps } from "./types"

function upperFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

export function CalendarView({ tasks, now, timeZone, onOpenTask }: ViewProps) {
  const todayKey = dayKey(now, timeZone)
  const [month, setMonth] = useState(() => startOfMonth(new Date(`${todayKey}T12:00:00`)))
  const [selected, setSelected] = useState(todayKey)

  const byDay = useMemo(() => {
    const map = new Map<string, TaskView[]>()
    for (const task of tasks) {
      if (!task.due_at) continue
      const key = dayKey(task.due_at, timeZone)
      const list = map.get(key)
      if (list) list.push(task)
      else map.set(key, [task])
    }
    return map
  }, [tasks, timeZone])

  const noDate = tasks.filter((task) => !task.due_at)
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  })
  const selectedTasks = byDay.get(selected) ?? []

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl leading-7 font-semibold tracking-[-0.01em]">
            {upperFirst(format(month, "MMMM 'de' yyyy", { locale: ptBR }))}
          </h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeftIcon strokeWidth={1.75} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setMonth(startOfMonth(new Date(`${todayKey}T12:00:00`)))
                setSelected(todayKey)
              }}
            >
              Hoje
            </Button>
            <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRightIcon strokeWidth={1.75} />
            </Button>
          </div>
        </div>

        <div role="grid" aria-label="Calendário de tarefas" className="grid grid-cols-7 border-t border-l border-border">
          {WEEKDAYS.map((name) => (
            <div
              key={name}
              role="columnheader"
              className="border-r border-b border-border py-2 text-center text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              {name}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd")
            const dayTasks = byDay.get(key) ?? []
            const isToday = key === todayKey
            const isSelected = key === selected
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}, ${dayTasks.length} tarefas`}
                aria-selected={isSelected}
                onClick={() => setSelected(key)}
                className={cn(
                  "flex min-h-16 flex-col items-stretch gap-1 border-r border-b border-border p-1.5 text-left outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-28",
                  !isSameMonth(day, month) && "text-muted-foreground",
                  isSelected && "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "tabular flex size-6 items-center justify-center self-start rounded-full text-[13px] leading-5",
                    isToday && "bg-highlight font-semibold text-highlight-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
                <span className="hidden flex-col gap-1 md:flex">
                  {dayTasks.slice(0, 3).map((task) => (
                    <span
                      key={task.id}
                      className={cn(
                        "truncate rounded-md px-1.5 py-0.5 text-xs leading-4",
                        task.swatch === "neutro" ? "bg-secondary" : getSwatch(task.swatch).chip,
                        task.completed_at && "line-through opacity-70"
                      )}
                    >
                      {task.title}
                    </span>
                  ))}
                  {dayTasks.length > 3 ? (
                    <span className="text-xs leading-4 text-muted-foreground">+{dayTasks.length - 3}</span>
                  ) : null}
                </span>
                {dayTasks.length > 0 ? (
                  <span className="tabular flex items-center gap-1 text-[11px] leading-4 text-muted-foreground md:hidden">
                    <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
                    {dayTasks.length}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <section className="flex flex-col">
        <h3 className="mb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {format(new Date(`${selected}T12:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </h3>
        {selectedTasks.length === 0 ? (
          <p className="py-4 text-[15px] leading-6 text-muted-foreground">Nenhuma tarefa neste dia.</p>
        ) : (
          selectedTasks.map((task) => (
            <button key={task.id} type="button" className="text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => onOpenTask(task.id)}>
              <ListRow
                title={task.title}
                description={task.category ?? undefined}
                trailing={
                  <span className="flex items-center gap-3">
                    <PriorityIcon priority={task.priority} className="text-muted-foreground" />
                    <DueLabel task={task} now={now} timeZone={timeZone} />
                  </span>
                }
              />
            </button>
          ))
        )}
      </section>

      {noDate.length > 0 ? (
        <section className="flex flex-col">
          <h3 className="mb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Sem data · <span className="tabular">{noDate.length}</span>
          </h3>
          {noDate.map((task) => (
            <button key={task.id} type="button" className="text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => onOpenTask(task.id)}>
              <ListRow title={task.title} description={task.category ?? undefined} />
            </button>
          ))}
        </section>
      ) : null}
    </div>
  )
}
