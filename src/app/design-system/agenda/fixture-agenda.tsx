"use client"

import { useMemo } from "react"

import { AgendaScreen, type AgendaInitial } from "@/components/calendar/agenda-screen"
import type { EventRow } from "@/features/calendar/types"
import type { DeadlineRow } from "@/features/studies/types"
import type { WorkoutPlanRow } from "@/features/workouts/types"
import { toDueIso } from "@/lib/dates"

const TZ = "America/Sao_Paulo"
const U = "00000000-0000-4000-8000-000000000001"

function ymd(offsetDays: number, nowMs: number) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date(nowMs + offsetDays * 86_400_000))
}

function build(nowIso: string): AgendaInitial {
  const now = new Date(nowIso).getTime()
  let n = 0
  const event = (title: string, dayOffset: number, start: string, end: string, over: Partial<EventRow> = {}): EventRow => {
    n += 1
    const day = ymd(dayOffset, now)
    return {
      id: `e0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      user_id: U,
      title,
      starts_at: toDueIso(day, start, TZ),
      ends_at: toDueIso(day, end, TZ),
      all_day: false,
      description: null,
      location: null,
      category: null,
      swatch: "neutro",
      rrule: null,
      reminder_offsets: [],
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
      ...over,
    }
  }
  const events: EventRow[] = [
    // Four on one day (to get the "+N" pill) with overlaps; one legacy Lima swatch, one with no color.
    event("Reunião de produto", 0, "09:00", "10:30", { swatch: "lima-verso" }),
    event("Almoço com cliente", 0, "12:00", "13:30"),
    event("Revisão de contrato", 0, "12:30", "14:00", { swatch: "tinta-verso" }),
    event("Dentista", 0, "15:00", "16:00", { swatch: "lima", location: "Clínica Sorriso" }),
    event("Aula de inglês", 0, "18:30", "19:30"),
    event("Viagem a Curitiba", 2, "00:00", "23:59", { all_day: true }),
  ]
  return {
    events,
    plans: [{ id: "f0000000-0000-4000-8000-000000000001", name: "Treino A", weekdays: [1, 3, 5] } as unknown as WorkoutPlanRow],
    deadlines: [{ id: "f1000000-0000-4000-8000-000000000001", title: "Prova de cálculo", due_on: ymd(1, now), kind: "exam" } as unknown as DeadlineRow],
    tasks: [
      { id: "d0000000-0000-4000-8000-000000000001", title: "Comprar planta para a sala", due_at: toDueIso(ymd(0, now), null, TZ), due_has_time: false, board_id: "b0000000-0000-4000-8000-000000000001", board_name: "Minhas tarefas" },
      { id: "d0000000-0000-4000-8000-000000000002", title: "Ligar para o contador", due_at: toDueIso(ymd(0, now), "17:00", TZ), due_has_time: true, board_id: "b0000000-0000-4000-8000-000000000001", board_name: "Minhas tarefas" },
    ],
  }
}

export function FixtureAgenda({ nowIso }: { nowIso: string }) {
  const initial = useMemo(() => build(nowIso), [nowIso])
  // In-memory task actions: completing and deleting work without a session.
  const taskApi = { complete: async () => ({ ok: true }), remove: async () => ({ ok: true }) }
  return <AgendaScreen nowIso={nowIso} initial={initial} taskApi={taskApi} memory />
}

