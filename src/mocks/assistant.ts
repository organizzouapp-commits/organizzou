import type { ModuleId } from "@/components/organizzou/modules"
import type { AssistantReply } from "@/features/assistant/types"
import { expandEvent } from "@/features/calendar/recurrence"
import { monthOf, spendByCategory, totals } from "@/features/finance/stats"
import { formatBRL, parseBRL } from "@/lib/money"

import { buildMockEvents } from "./calendar"
import { buildMockTransactions, mockCategories } from "./finance"
import { mockStudySlots, mockWorkoutSlots } from "./schedule"
import { at, dayOf, MOCK_TIMEZONE } from "./time"

const CATEGORY_HINTS: [RegExp, string][] = [
  [/mercado|supermercado|feira|padaria|hortifruti/i, "Mercado"],
  [/gasolina|combust[ií]vel|uber|99|estaciona|ônibus|onibus|metr[oô]/i, "Transporte"],
  [/restaurante|almo[cç]o|jantar|ifood|lanche|pizza|caf[eé]/i, "Restaurantes"],
  [/farm[aá]cia|rem[eé]dio|m[eé]dico|dentista|consulta/i, "Saúde"],
  [/cinema|show|bar|jogo|viagem|passeio/i, "Lazer"],
  [/netflix|spotify|assinatura|prime/i, "Assinaturas"],
  [/aluguel|condom[ií]nio|luz|internet|[aá]gua/i, "Moradia"],
]

/** Where a free-text capture should go (quick capture and chat both use this). */
export function classifyCapture(text: string): ModuleId | null {
  const t = text.toLowerCase()
  if (!t.trim()) return null
  if (/gast(ei|o)|paguei|comprei|recebi|sal[aá]rio|r\$\s*\d/.test(t)) return "financas"
  if (/estudei|estudar|flashcard|prova|mat[eé]ria/.test(t)) return "estudos"
  if (/treino|treinei|s[eé]ries|academia|corrida/.test(t)) return "treinos"
  if (/almo[cç]ei|jantei|comi|caf[eé] da manh[ãa]|bebi \d|kcal|peso/.test(t)) return "dieta"
  if (/h[aá]bito|meditei|li \d|bebi [àa]gua/.test(t)) return "rotina"
  if (/reuni[ãa]o|consulta|marcar|evento|compromisso/.test(t)) return "agenda"
  if (/lembr(e|ar)|me avisa|anota|anotar|ideia/.test(t)) return "notas"
  if (/tarefa|fazer|entregar|enviar|ligar|pagar/.test(t)) return "tarefas"
  return null
}

export function guessCategory(text: string) {
  return CATEGORY_HINTS.find(([pattern]) => pattern.test(text))?.[1] ?? "Outros"
}

/** "gastei 45 no mercado" → { cents: 4500, what: "mercado" } */
export function parseExpense(text: string) {
  const match = text.match(/gast(?:ei|o)\s+(?:r\$\s*)?([\d.,]+)\s*(?:reais)?\s*(?:no|na|em|de|com|para)?\s*(.*)/i)
  if (!match) return null
  const cents = parseBRL(match[1])
  if (!cents) return null
  return { cents, what: match[2].trim().replace(/[.!?]+$/, "") || "gasto avulso" }
}

const WEEKDAYS: Record<string, number> = { domingo: 0, segunda: 1, terça: 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6, sabado: 6 }

/** Offset in days from `today` for words like hoje, amanhã or a weekday name. Null when none is found. */
export function parseDueOffset(text: string, todayWeekday: number): number | null {
  const t = text.toLowerCase()
  if (/\bhoje\b/.test(t)) return 0
  if (/amanh[ãa]/.test(t)) return 1
  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}`).test(t)) {
      const diff = (weekday - todayWeekday + 7) % 7
      return diff === 0 ? 7 : diff
    }
  }
  return null
}

function stripDue(text: string) {
  return text
    .replace(/\b(para|pra|at[ée])?\s*(hoje|amanh[ãa]|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(-feira)?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const SUGGESTIONS = [
  "Gastei R$ 45 no mercado",
  "Adicionar tarefa pagar o aluguel sexta",
  "Quanto gastei este mês?",
  "O que tenho amanhã?",
  "Estudei 2 horas de Constitucional",
  "Terminei o treino",
]
export const assistantSuggestions = SUGGESTIONS

/** Canned, rule-based replies that mimic the assistant's tone (short, calm, pt-BR). */
export function buildReply(input: string, nowIso: string): AssistantReply {
  const text = input.trim()
  const lower = text.toLowerCase()
  const todayWeekday = new Date(at(nowIso, 0, "12:00")).getUTCDay()

  if (/senha|cofre/.test(lower)) {
    return {
      text: "Não tenho acesso ao cofre de senhas, e isso é de propósito: tudo lá é criptografado só no seu aparelho. Posso ajudar com tarefas, finanças, treinos e o resto.",
    }
  }

  if (/apag|exclu|delet|remov/.test(lower)) {
    const target = text.replace(/^(apague|apagar|exclua|excluir|delete|remova|remover)\s+(a\s+|o\s+)?/i, "").trim() || "esse item"
    return {
      text: `Posso fazer isso, mas antes preciso da sua confirmação.`,
      confirm: {
        question: `Apagar “${capitalize(target)}”? Essa ação não pode ser desfeita.`,
        confirmLabel: "Sim, apagar",
        onConfirm: {
          reply: "Pronto, apaguei. Ficou registrado no seu histórico de ações.",
          action: { module: "tarefas", title: "Item apagado", detail: capitalize(target), undoable: false },
        },
      },
    }
  }

  const expense = parseExpense(text)
  if (expense) {
    const category = guessCategory(expense.what)
    return {
      text: `Gasto de ${formatBRL(expense.cents)} registrado em ${category}.`,
      action: { module: "financas", title: "Gasto registrado", detail: `${formatBRL(expense.cents)} · ${category}${expense.what.toLowerCase() === category.toLowerCase() ? "" : ` · ${capitalize(expense.what)}`}`, undoable: true },
    }
  }

  if (/quanto gastei|gastos? (do|deste|desse) m[eê]s|resumo financeiro/.test(lower)) {
    const month = monthOf(dayOf(nowIso))
    const all = buildMockTransactions(nowIso)
    const sum = totals(all, month)
    const top = spendByCategory(mockCategories, all, month)[0]
    return {
      text: "Aqui está o resumo do mês até agora:",
      rows: [
        { label: "Gastos", value: formatBRL(sum.expense) },
        { label: "Entradas", value: formatBRL(sum.income) },
        { label: "Sobra", value: formatBRL(sum.surplus) },
        { label: "Maior categoria", value: `${top.category.name} (${formatBRL(top.spent)})` },
      ],
    }
  }

  if (/o que tenho|minha agenda|compromissos|agenda de (hoje|amanh)/.test(lower)) {
    const offset = /amanh[ãa]/.test(lower) ? 1 : 0
    const from = new Date(at(nowIso, offset, "00:00"))
    const to = new Date(at(nowIso, offset + 1, "00:00"))
    const items = [
      ...buildMockEvents(nowIso).flatMap((e) => expandEvent(e, from, to, MOCK_TIMEZONE)),
      ...mockWorkoutSlots(nowIso).filter((s) => new Date(s.start) >= from && new Date(s.start) < to).map((s) => ({ title: s.title, start: new Date(s.start) })),
      ...mockStudySlots(nowIso).filter((s) => new Date(s.start) >= from && new Date(s.start) < to).map((s) => ({ title: s.title, start: new Date(s.start) })),
    ].sort((a, b) => a.start.getTime() - b.start.getTime())
    const label = offset === 1 ? "amanhã" : "hoje"
    if (items.length === 0) return { text: `Você não tem nada marcado para ${label}. Dia livre!` }
    return {
      text: `Para ${label} você tem ${items.length} ${items.length === 1 ? "compromisso" : "compromissos"}:`,
      rows: items.map((i) => ({
        label: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: MOCK_TIMEZONE }).format(i.start),
        value: i.title,
      })),
    }
  }

  const study = lower.match(/estudei\s+(\d+(?:[.,]\d+)?)\s*(h|hora|horas|min|minutos)/)
  if (study) {
    const minutes = Math.round(Number(study[1].replace(",", ".")) * (study[2].startsWith("h") ? 60 : 1))
    const subject = /constitucional/.test(lower) ? "Direito Constitucional" : /estat[ií]stica/.test(lower) ? "Estatística" : /ingl[eê]s/.test(lower) ? "Inglês" : null
    if (!subject) {
      return { text: `Anotei ${minutes} minutos de estudo. De qual matéria foi?`, choices: ["Direito Constitucional", "Estatística", "Inglês"] }
    }
    return {
      text: `${minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`} de ${subject} registradas.`,
      action: { module: "estudos", title: "Estudo registrado", detail: `${subject} · ${minutes} min`, undoable: true },
    }
  }

  if (/terminei o treino|treinei|fiz o treino/.test(lower)) {
    const plan = /peito|a\b/.test(lower) ? "Treino A — Peito e tríceps" : /costas|b\b/.test(lower) ? "Treino B — Costas e bíceps" : /perna|c\b/.test(lower) ? "Treino C — Pernas" : null
    if (!plan) {
      return { text: "Qual treino você fez? Prefiro confirmar antes de salvar.", choices: ["Treino A — Peito e tríceps", "Treino B — Costas e bíceps", "Treino C — Pernas"] }
    }
    return {
      text: `${plan} marcado como concluído hoje.`,
      action: { module: "treinos", title: "Treino concluído", detail: plan, undoable: true },
    }
  }
  if (/^treino [abc]/i.test(lower)) {
    return {
      text: `${capitalize(text)} marcado como concluído hoje.`,
      action: { module: "treinos", title: "Treino concluído", detail: capitalize(text), undoable: true },
    }
  }

  if (/almo[cç]ei|jantei|comi |tomei caf[eé]/.test(lower)) {
    const meal = /jantei/.test(lower) ? "Jantar" : /caf[eé]/.test(lower) ? "Café da manhã" : "Almoço"
    return {
      text: `${meal} registrado. Estimei cerca de 650 kcal. Quer ajustar as porções?`,
      action: { module: "dieta", title: `${meal} registrado`, detail: capitalize(text.replace(/^(almocei|jantei|comi)\s+/i, "")), undoable: true },
    }
  }

  const task = text.match(/^(?:adicion\w*|cri\w*|nova)\s+tarefa\s*[:\-]?\s*(.+)/i)
  if (task || (classifyCapture(text) === "tarefas" && /^(pagar|ligar|enviar|entregar|comprar)/i.test(text))) {
    const raw = task ? task[1] : text
    const offset = parseDueOffset(raw, todayWeekday)
    const title = capitalize(stripDue(raw))
    return {
      text: `Tarefa criada: ${title}${offset !== null ? ` — ${offset === 0 ? "para hoje" : offset === 1 ? "para amanhã" : `para ${["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][(todayWeekday + offset) % 7]}`}` : ""}.`,
      action: { module: "tarefas", title: "Tarefa criada", detail: title, undoable: true },
    }
  }

  const reminder = text.match(/(?:me lembra|lembre-me|lembrete)\s+(?:de\s+)?(.+)/i)
  if (reminder) {
    return {
      text: `Combinado, vou te lembrar: ${reminder[1].replace(/[.!?]+$/, "")}.`,
      action: { module: "notas", title: "Lembrete criado", detail: capitalize(reminder[1]), undoable: true },
    }
  }

  return {
    text: "Não tenho certeza do que você quis dizer. Quer registrar um gasto, uma tarefa, um treino ou ver como está o mês?",
    choices: ["Gastei R$ 45 no mercado", "Adicionar tarefa pagar o aluguel sexta", "Quanto gastei este mês?"],
  }
}
