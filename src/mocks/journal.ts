import { shiftDay } from "@/features/habits/stats"
import type { JournalDay, Mood } from "@/features/journal/types"

import { dayOf } from "./time"

const USER = "00000000-0000-4000-8000-000000000001"

const NOTES = [
  "Dia produtivo. Consegui fechar a proposta e ainda sobrou tempo para caminhar.",
  "Cansada. A reunião se estendeu e não consegui estudar.",
  "Almoço com a Carol foi ótimo, precisava desse respiro.",
  "Acordei sem energia, mas o treino ajudou a virar o dia.",
  "Dia corrido, muita coisa para resolver. Anotei tudo nas tarefas.",
  "Fim de semana tranquilo. Li bastante e dormi bem.",
  "Ansiosa com a prova de Estatística, mas revisei os flashcards.",
  "Dia leve. Cozinhei, assisti a um filme e fui dormir cedo.",
]

/** Thirty days of check-ins. Mood loosely follows sleep, training and study, like real data tends to. */
export function buildMockJournal(now: string): JournalDay[] {
  const today = dayOf(now)
  const days: JournalDay[] = []
  for (let back = 30; back >= 1; back -= 1) {
    const day = shiftDay(today, -back)
    const sleep = Math.round((5.2 + ((back * 7) % 11) * 0.35) * 2) / 2
    const trained = (back * 5) % 7 < 3
    const studied = ((back * 11) % 5) * 30
    const raw = 2.4 + (sleep >= 7 ? 1.2 : sleep >= 6 ? 0.5 : 0) + (trained ? 0.6 : 0) + (studied >= 60 ? 0.4 : 0) + (((back * 3) % 5) - 2) * 0.25
    const mood = Math.max(1, Math.min(5, Math.round(raw))) as Mood
    days.push({
      id: `j${String(back).padStart(3, "0")}0000-0000-4000-8000-000000000000`,
      user_id: USER,
      entry_date: day,
      mood,
      text: back % 3 === 0 ? NOTES[back % NOTES.length] : "",
      sleep_hours: sleep,
      created_at: `${day}T21:00:00.000Z`,
      updated_at: `${day}T21:00:00.000Z`,
      trained,
      studied_min: studied,
    })
  }
  return days
}
