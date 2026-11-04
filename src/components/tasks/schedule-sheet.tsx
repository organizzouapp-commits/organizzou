"use client"

import { useEffect, useState } from "react"
import { addDays, format, parseISO } from "date-fns"

import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import type { TaskView } from "@/features/tasks/types"
import { dayKey, inTz } from "@/lib/dates"

/** "Agendar…": a bottom sheet with date shortcuts, a day and an optional time. Used by the calendar swipe panel and ⋯ menu. */
export function ScheduleSheet({ task, open, onOpenChange, todayKey, timeZone, onConfirm }: { task: TaskView | null; open: boolean; onOpenChange: (open: boolean) => void; todayKey: string; timeZone: string; onConfirm: (task: TaskView, day: string, time: string | null) => void }) {
  const [date, setDate] = useState(todayKey)
  const [time, setTime] = useState("")
  useEffect(() => {
    if (!open || !task) return
    // Starts on the task's own day when it has one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(task.due_at ? dayKey(task.due_at, timeZone) : todayKey)
    setTime(task.due_at && task.due_has_time ? format(inTz(task.due_at, timeZone), "HH:mm") : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id])
  const tomorrow = format(addDays(parseISO(todayKey), 1), "yyyy-MM-dd")
  const nextWeek = format(addDays(parseISO(todayKey), 7), "yyyy-MM-dd")
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Agendar</DrawerTitle>
          <DrawerDescription className="line-clamp-2">{task?.title}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div role="group" aria-label="Atalhos de data" className="flex flex-wrap gap-2">
            {[
              { id: todayKey, label: "Hoje" },
              { id: tomorrow, label: "Amanhã" },
              { id: nextWeek, label: "Próxima semana" },
            ].map((chip) => (
              <Button key={chip.label} type="button" variant={date === chip.id ? "default" : "outline"} aria-pressed={date === chip.id} className="h-11" onClick={() => setDate(chip.id)}>
                {chip.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
              Dia
              <Input type="date" aria-label="Dia" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-11 rounded-xl text-[15px] text-foreground" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
              Hora (opcional)
              <Input type="time" step={300} aria-label="Hora" value={time} onChange={(e) => setTime(e.target.value)} className="h-11 rounded-xl text-[15px] text-foreground" />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={() => {
                if (task) onConfirm(task, date, time || null)
                onOpenChange(false)
              }}
            >
              Agendar
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

