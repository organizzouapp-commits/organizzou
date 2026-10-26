import type { GoalLinkRow, GoalMilestoneRow, GoalWithDetails } from "@/features/goals/types"

import { dayOf } from "./time"
import { shiftDay } from "@/features/habits/stats"

const USER = "00000000-0000-4000-8000-000000000001"

export function buildMockGoals(now: string): GoalWithDetails[] {
  const today = dayOf(now)
  const stamp = shiftDay(today, -60) + "T12:00:00.000Z"
  let n = 0
  const id = (prefix: string) => `${prefix}000000-0000-4000-8000-${String(++n).padStart(12, "0")}`

  const goal = (
    title: string,
    description: string,
    deadlineOffset: number | null,
    links: Omit<GoalLinkRow, "id" | "goal_id">[],
    milestones: { title: string; done: boolean }[],
    status: "active" | "done" = "active"
  ): GoalWithDetails => {
    const goalId = id("gl")
    return {
      id: goalId,
      user_id: USER,
      title,
      description,
      deadline: deadlineOffset === null ? null : shiftDay(today, deadlineOffset),
      status,
      created_at: stamp,
      updated_at: stamp,
      links: links.map((l) => ({ ...l, id: id("lk"), goal_id: goalId })),
      milestones: milestones.map((m): GoalMilestoneRow => ({ ...m, id: id("ms"), goal_id: goalId })),
    }
  }

  return [
    goal(
      "Passar na 1ª fase da OAB",
      "Estudar com constância até o exame e chegar na prova com todo o edital revisado.",
      42,
      [
        { module: "estudos", label: "Horas de estudo", done: 62, total: 120, unit: "h" },
        { module: "estudos", label: "Flashcards dominados", done: 84, total: 200, unit: "cartões" },
        { module: "rotina", label: "Semanas com meta de estudo batida", done: 14, total: 18, unit: "semanas" },
        { module: "tarefas", label: "Listas de exercícios entregues", done: 7, total: 12, unit: "listas" },
      ],
      [
        { title: "Fechar o edital de Direito Constitucional", done: true },
        { title: "Fazer 3 simulados completos", done: false },
        { title: "Revisar todos os erros dos simulados", done: false },
      ]
    ),
    goal(
      "Juntar R$ 20.000 de reserva de emergência",
      "Seis meses de custo fixo guardados em investimento de liquidez diária.",
      240,
      [
        { module: "financas", label: "Valor guardado (em reais)", done: 12400, total: 20000, unit: "R$" },
        { module: "rotina", label: "Meses guardando R$ 500 ou mais", done: 9, total: 12, unit: "meses" },
      ],
      [
        { title: "Abrir conta em corretora", done: true },
        { title: "Configurar aporte automático", done: true },
        { title: "Chegar a R$ 15.000", done: false },
      ]
    ),
    goal(
      "Correr 10 km sem parar",
      "Evoluir de 5 km para 10 km com treinos leves de corrida aos sábados.",
      90,
      [
        { module: "treinos", label: "Corridas de 5 km ou mais", done: 3, total: 8, unit: "corridas" },
        { module: "rotina", label: "Sábados de corrida cumpridos", done: 5, total: 12, unit: "sábados" },
      ],
      [
        { title: "Correr 5 km em menos de 30 minutos", done: true },
        { title: "Correr 8 km sem parar", done: false },
      ]
    ),
    goal(
      "Ler 24 livros em 2026",
      "Dois livros por mês, alternando ficção e não ficção.",
      null,
      [
        { module: "estudos", label: "Livros concluídos", done: 15, total: 24, unit: "livros" },
        { module: "rotina", label: "Dias lendo 20 páginas", done: 210, total: 300, unit: "dias" },
      ],
      []
    ),
    goal(
      "Terminar o curso de fotografia",
      "Concluído com certificado no mês passado.",
      -30,
      [{ module: "estudos", label: "Módulos concluídos", done: 12, total: 12, unit: "módulos" }],
      [{ title: "Entregar o projeto final", done: true }],
      "done"
    ),
  ]
}
