import { shiftDay } from "@/features/habits/stats"
import type {
  DeadlineRow,
  FlashcardDeckRow,
  FlashcardRow,
  StudySessionRow,
  SubjectRow,
} from "@/features/studies/types"

import { dayOf } from "./time"

const USER = "00000000-0000-4000-8000-000000000001"
const stamp = { created_at: "2026-01-05T09:00:00.000Z", updated_at: "2026-01-05T09:00:00.000Z" }

const subject = (n: number, row: Omit<SubjectRow, "id" | "user_id" | "created_at" | "updated_at">): SubjectRow => ({
  id: `s0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
  user_id: USER,
  ...row,
  ...stamp,
})

export const mockSubjects: SubjectRow[] = [
  subject(1, { name: "Direito Constitucional", type: "subject", priority: "high", swatch: "tinta-verso", weekly_goal_min: 360, progress_pct: null, progress_label: null }),
  subject(2, { name: "Estatística", type: "subject", priority: "medium", swatch: "lima-verso", weekly_goal_min: 240, progress_pct: null, progress_label: null }),
  subject(3, { name: "Metodologia Científica", type: "subject", priority: "medium", swatch: "papel", weekly_goal_min: 120, progress_pct: null, progress_label: null }),
  subject(4, { name: "Inglês — Intermediário", type: "course", priority: "medium", swatch: "lima", weekly_goal_min: 210, progress_pct: 62, progress_label: "Módulo 8 de 13" }),
  subject(5, { name: "Sapiens — Yuval Noah Harari", type: "book", priority: "low", swatch: "grafite", weekly_goal_min: 90, progress_pct: 45, progress_label: "pág. 210 de 464" }),
  subject(6, { name: "OAB — 1ª fase", type: "exam", priority: "high", swatch: "tinta-verso", weekly_goal_min: 300, progress_pct: 38, progress_label: "Edital: 38% revisado" }),
]

/** Four weeks of sessions with a different rhythm per subject (deterministic). */
export function buildMockSessions(now: string): StudySessionRow[] {
  const today = dayOf(now)
  const rows: StudySessionRow[] = []
  mockSubjects.forEach((s, index) => {
    for (let back = 0; back < 28; back += 1) {
      const day = shiftDay(today, -back)
      const weekday = new Date(`${day}T12:00:00`).getDay()
      const studies = (weekday + index) % 7 < 4 && (back * 3 + index) % 5 !== 0
      if (!studies) continue
      const minutes = [25, 50, 75, 90, 45, 60][(back + index * 2) % 6]
      rows.push({
        id: `ss${index}${String(back).padStart(2, "0")}0000-0000-4000-8000-000000000000`,
        user_id: USER,
        subject_id: s.id,
        studied_on: day,
        minutes,
        mode: minutes % 25 === 0 ? "pomodoro" : "free",
      })
    }
  })
  return rows
}

export function buildMockDeadlines(now: string): DeadlineRow[] {
  const today = dayOf(now)
  const row = (n: number, subjectNumber: number | null, title: string, offset: number, kind: DeadlineRow["kind"]): DeadlineRow => ({
    id: `dl000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
    user_id: USER,
    subject_id: subjectNumber ? mockSubjects[subjectNumber - 1].id : null,
    title,
    due_on: shiftDay(today, offset),
    kind,
  })
  return [
    row(1, 6, "OAB — 1ª fase (Exame Unificado)", 42, "exam"),
    row(2, 2, "Prova de Estatística — unidade 2", 9, "exam"),
    row(3, 3, "Entrega do artigo de Metodologia", 9, "delivery"),
    row(4, 4, "Teste de nível do curso de inglês", 21, "exam"),
  ]
}

export const mockDecks: FlashcardDeckRow[] = [
  { id: "d0000000-0000-4000-8000-000000000001", user_id: USER, subject_id: mockSubjects[0].id, name: "Constitucional — princípios fundamentais" },
  { id: "d0000000-0000-4000-8000-000000000002", user_id: USER, subject_id: mockSubjects[3].id, name: "Inglês — phrasal verbs" },
]

export function buildMockCards(now: string): FlashcardRow[] {
  const today = dayOf(now)
  const card = (n: number, deck: number, front: string, back: string, dueOffset: number, reps: number): FlashcardRow => ({
    id: `fc000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
    deck_id: mockDecks[deck - 1].id,
    front,
    back,
    ease: 2.5,
    interval_days: reps === 0 ? 0 : reps * 3,
    repetitions: reps,
    due_on: shiftDay(today, dueOffset),
  })
  return [
    card(1, 1, "Quais são os fundamentos da República (art. 1º da CF)?", "Soberania, cidadania, dignidade da pessoa humana, valores sociais do trabalho e da livre iniciativa e pluralismo político.", -1, 1),
    card(2, 1, "Quantos são os Poderes da União e quais são?", "Três, independentes e harmônicos entre si: Legislativo, Executivo e Judiciário.", 0, 0),
    card(3, 1, "O que diz o princípio da legalidade (art. 5º, II)?", "Ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei.", 0, 2),
    card(4, 1, "Qual a diferença entre direitos e garantias fundamentais?", "Direitos declaram bens da vida; garantias são instrumentos para assegurá-los.", 4, 3),
    card(5, 1, "Qual o prazo do mandato do Presidente da República?", "Quatro anos, com possibilidade de uma reeleição para o período subsequente.", 6, 3),
    card(6, 2, "give up", "desistir — “I will never give up on my dreams.”", 0, 0),
    card(7, 2, "look forward to", "aguardar com expectativa — “I look forward to meeting you.”", 0, 1),
    card(8, 2, "come across", "encontrar por acaso — “I came across an old photo yesterday.”", -2, 1),
    card(9, 2, "run out of", "ficar sem, acabar — “We ran out of coffee.”", 5, 3),
    card(10, 2, "figure out", "descobrir, entender — “I can’t figure out this puzzle.”", 3, 2),
  ]
}

/** Canned cards used by the "Gerar com IA" prototype action. */
export const generatedCards = [
  { front: "O que é controle de constitucionalidade?", back: "Verificação da compatibilidade de leis e atos normativos com a Constituição." },
  { front: "Quais são as espécies de controle quanto ao momento?", back: "Preventivo (antes da lei) e repressivo (depois de editada)." },
  { front: "Quem exerce o controle concentrado no âmbito federal?", back: "O Supremo Tribunal Federal, por meio de ADI, ADC, ADO e ADPF." },
  { front: "O que é uma cláusula pétrea?", back: "Matéria que não pode ser abolida por emenda constitucional (art. 60, § 4º)." },
]
