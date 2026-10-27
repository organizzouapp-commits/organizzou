"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { DueLabel, PriorityIcon } from "@/components/tasks/task-meta"
import { Checkbox } from "@/components/ui/checkbox"
import { completeTask } from "@/features/tasks/actions"
import type { TodayTask } from "@/features/tasks/today"
import { cn } from "@/lib/utils"

type TodayTasksProps = {
  tasks: TodayTask[]
  now: string
  timeZone: string
  /** Hide the checkbox for read-only lists such as "Próximas". */
  completable?: boolean
}

export function TodayTasks({ tasks, now, timeZone, completable = true }: TodayTasksProps) {
  const router = useRouter()
  const [done, setDone] = useState<Set<string>>(new Set())
  const reference = new Date(now)

  async function toggle(task: TodayTask) {
    const next = !done.has(task.id)
    setDone((current) => {
      const copy = new Set(current)
      if (next) copy.add(task.id)
      else copy.delete(task.id)
      return copy
    })
    const result = await completeTask({ id: task.id, done: next })
    if (!result.ok) {
      setDone((current) => {
        const copy = new Set(current)
        if (next) copy.delete(task.id)
        else copy.add(task.id)
        return copy
      })
      toast.error(result.error)
      return
    }
    toast(next ? "Tarefa concluída." : "Tarefa reaberta.")
    router.refresh()
  }

  return (
    <div className="flex flex-col">
      {tasks.map((task) => {
        const checked = done.has(task.id)
        return (
          <div key={task.id} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
            {completable ? (
              <Checkbox
                checked={checked}
                onCheckedChange={() => void toggle(task)}
                aria-label={checked ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
              />
            ) : null}
            <Link
              href={`/dashboard/tarefas/${task.boardId}`}
              className="flex min-w-0 flex-1 flex-col rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className={cn("truncate text-[15px] leading-6", checked && "text-muted-foreground line-through")}>
                {task.title}
              </span>
              <span className="flex items-center gap-3">
                <DueLabel task={task} now={reference} timeZone={timeZone} />
                <span className="truncate text-[13px] leading-5 text-muted-foreground">{task.boardName}</span>
              </span>
            </Link>
            <PriorityIcon priority={task.priority} className="shrink-0 text-muted-foreground" />
          </div>
        )
      })}
    </div>
  )
}
