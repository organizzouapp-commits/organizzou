import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { SeuDia } from "@/components/organizzou/today/seu-dia"
import { DietPanel, FinancePanel, MoodPanel, NotesPanel, StudyPanel, WorkoutPanel } from "@/components/organizzou/today/panels"
import { TodayLayout } from "@/components/organizzou/today/today-layout"
import { DEFAULT_PREFS } from "@/features/today/prefs"
import type { DayItem } from "@/features/today/types"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Development-only fixture of the "Hoje" page: the real components fed with rich, deterministic-looking data (relative to now), so the
 * layout, the accordion and the timeline can be reviewed and tested without a database. Server actions fail here (nobody is signed in);
 * the Playwright tests answer them with a stub. Returns 404 in production.
 */
const MIN = 60_000
const iso = (ms: number) => new Date(ms).toISOString()
const clockNow = () => Date.now()

function build(nowMs: number): { items: DayItem[]; tomorrow: DayItem[] } {
  const at = (offsetMin: number) => iso(nowMs + offsetMin * MIN)
  const items: DayItem[] = [
    { id: "o1", kind: "task", title: "Enviar relatório semanal à Marina", meta: "Trabalho", at: null, overdue: true, overdueSince: at(-14 * 60), priority: "high", due: { at: at(-14 * 60), hasTime: false }, href: "/dashboard/tarefas", action: "check" },
    { id: "o2", kind: "task", title: "Marcar consulta no dentista", meta: "Casa e vida", at: null, overdue: true, overdueSince: at(-26 * 60), due: { at: at(-26 * 60), hasTime: false }, href: "/dashboard/tarefas", action: "check" },
    { id: "o3", kind: "task", title: "Renovar o seguro do carro", meta: "Casa e vida", at: null, overdue: true, overdueSince: at(-50 * 60), due: { at: at(-50 * 60), hasTime: false }, href: "/dashboard/tarefas", action: "check" },
    { id: "o4", kind: "task", title: "Responder e-mails da faculdade", meta: "Estudos", at: null, overdue: true, overdueSince: at(-72 * 60), due: { at: at(-72 * 60), hasTime: false }, href: "/dashboard/tarefas", action: "check" },
    { id: "o5", kind: "bill", title: "Internet", meta: "Contas", at: null, overdue: true, overdueSince: at(-30 * 60), bill: { amount: "R$ 119,90", when: "venceu ontem" }, href: "/dashboard/financas", action: "pay" },
    { id: "e1", kind: "event", title: "Café com a equipe", meta: "Agenda · Escritório", at: at(-300), endAt: at(-270), durationMin: 30, href: "/dashboard/agenda", action: "none" },
    { id: "e2", kind: "event", title: "Consulta com a Dra. Camila (dentista)", meta: "Agenda · Clínica Sorriso", at: at(-150), endAt: at(-90), durationMin: 60, href: "/dashboard/agenda", action: "none" },
    { id: "t1", kind: "task", title: "Revisar proposta do cliente", meta: "Trabalho", at: at(-40), priority: "medium", due: { at: at(-40), hasTime: true }, href: "/dashboard/tarefas", action: "check" },
    { id: "e3", kind: "event", title: "Reunião de planejamento", meta: "Agenda · Sala 2", at: at(-15), endAt: at(45), durationMin: 60, href: "/dashboard/agenda", action: "none" },
    { id: "t2", kind: "task", title: "Ligar para o banco", meta: "Casa e vida", at: at(120), due: { at: at(120), hasTime: true }, href: "/dashboard/tarefas", action: "check" },
    { id: "w1", kind: "workout", title: "Treino B — Costas e bíceps", meta: "Treinos · Academia Smart Fit", at: at(240), endAt: at(300), durationMin: 60, href: "/dashboard/treinos", action: "check" },
    { id: "s1", kind: "study", title: "Estatística — unidade 2", meta: "Estudos · Bloco de estudo", at: at(360), endAt: at(420), durationMin: 60, href: "/dashboard/estudos", action: "none" },
    { id: "u1", kind: "task", title: "Comprar presente da Ana", meta: "Casa e vida", at: null, priority: "low", due: { at: at(0), hasTime: false }, href: "/dashboard/tarefas", action: "check" },
    { id: "u2", kind: "task", title: "Pagar boleto da faculdade", meta: "Finanças", at: null, due: { at: at(0), hasTime: false }, href: "/dashboard/tarefas", action: "check" },
    { id: "b1", kind: "bill", title: "Cartão de crédito", meta: "Contas", at: null, bill: { amount: "R$ 1.240,35", when: "vence hoje" }, href: "/dashboard/financas", action: "pay" },
    { id: "h1", kind: "habit", title: "Meditar 10 minutos", meta: "Hábitos", at: null, streak: 4, done: true, href: "/dashboard/rotina", action: "check" },
    { id: "h2", kind: "habit", title: "Ler 20 páginas", meta: "Hábitos", at: null, href: "/dashboard/rotina", action: "check" },
    { id: "h3", kind: "habit", title: "Beber água", meta: "Hábitos", at: null, habit: { qty: 1.25, target: 2.5, unit: "L" }, href: "/dashboard/rotina", action: "plus" },
    { id: "h4", kind: "habit", title: "Alongar", meta: "Hábitos", at: null, href: "/dashboard/rotina", action: "check" },
    { id: "d1", kind: "task", title: "Fechar a planilha do mês", meta: "Finanças", at: null, done: true, doneAtMs: nowMs - 30 * MIN, href: "/dashboard/tarefas", action: "check" },
  ]
  const tomorrow: DayItem[] = [{ id: "m1", kind: "event", title: "Dentista de retorno", meta: "Agenda", at: at(24 * 60 + 60), endAt: at(24 * 60 + 120), href: "/dashboard/agenda", action: "none" }]
  return { items, tomorrow }
}

async function Fixture() {
  await connection()
  const now = clockNow()
  const nowIso = iso(now)
  const { items, tomorrow } = build(now)
  const slots = {
    "panel:seu-dia": <SeuDia data={{ state: "ok", nowIso, items, tomorrow }} />,
    "panel:notas": (
      <NotesPanel
        data={{
          state: "ok",
          reminders: [
            { id: "r1", title: "Ligar para o contador sobre o imposto de renda", at: iso(now + 20 * MIN) },
            { id: "r2", title: "Levar o carro para a revisão", at: iso(now + 5 * 3_600_000) },
          ],
          pinned: [
            { id: "n1", title: "Ideias para o fim de semana", preview: "Trilha, cinema, almoço na casa da mãe" },
            { id: "n2", title: "Lista do mercado", preview: "Leite, ovos, café, frutas" },
          ],
        }}
      />
    ),
    "panel:financas": <FinancePanel data={{ state: "ok", surplus: "-R$ 973,20", surplusCents: -97320, surplusTrend: "down", budgetPct: 87, budgetLine: "R$ 5.205,60 de R$ 5.950,00" }} />,
    "panel:dieta": <DietPanel data={{ state: "ok", kcal: 1737, goalKcal: 2000, protein: 89, waterMl: 1250, waterGoalMl: 2500 }} />,
    "panel:treino": <WorkoutPanel data={{ state: "ok", title: "Treino B — Costas e bíceps", time: "18:00", doneToday: false, weekDone: 2, weekPlanned: 4 }} />,
    "panel:estudos": <StudyPanel data={{ state: "ok", studiedMin: 75, dailyGoalMin: 189, dueCards: 6, exam: { title: "Prova de Estatística — unidade 2", days: 9 } }} />,
    "panel:humor": <MoodPanel data={{ mood: null }} />,
  }
  return (
    <TooltipProvider>
      <main className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6">
        <TodayLayout slots={slots} skeletons={{}} serverPrefs={{ ...DEFAULT_PREFS, highlights: DEFAULT_PREFS.highlights.map((h) => ({ ...h, enabled: false })) }} source="default" />
      </main>
    </TooltipProvider>
  )
}

export default function HojeFixturePage() {
  if (process.env.NODE_ENV === "production") notFound()
  return (
    <Suspense>
      <Fixture />
    </Suspense>
  )
}
