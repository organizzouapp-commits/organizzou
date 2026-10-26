import { shiftMonth } from "@/features/finance/stats"
import type {
  AccountRow,
  CategoryRow,
  FinancialGoalRow,
  RecurringBillRow,
  TransactionRow,
} from "@/features/finance/types"

import { dayOf } from "./time"

const USER = "00000000-0000-4000-8000-000000000001"
const stamp = { created_at: "2026-01-01T10:00:00.000Z", updated_at: "2026-01-01T10:00:00.000Z" }

export const mockAccounts: AccountRow[] = [
  { id: "a0000000-0000-4000-8000-000000000001", user_id: USER, name: "Conta Nubank", institution: "Nubank", opening_balance_cents: 1_500_000, ...stamp },
  { id: "a0000000-0000-4000-8000-000000000002", user_id: USER, name: "Conta corrente Itaú", institution: "Itaú", opening_balance_cents: 350_000, ...stamp },
  { id: "a0000000-0000-4000-8000-000000000003", user_id: USER, name: "Carteira", institution: "Dinheiro", opening_balance_cents: 250_000, ...stamp },
]

const cat = (n: number, name: string, limit: number | null): CategoryRow => ({
  id: `c0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
  user_id: USER,
  name,
  monthly_limit_cents: limit,
  ...stamp,
})

export const mockCategories: CategoryRow[] = [
  cat(1, "Moradia", 240_000),
  cat(2, "Mercado", 120_000),
  cat(3, "Restaurantes", 50_000),
  cat(4, "Transporte", 40_000),
  cat(5, "Saúde", 30_000),
  cat(6, "Lazer", 35_000),
  cat(7, "Assinaturas", 20_000),
  cat(8, "Educação", 60_000),
  cat(9, "Salário", null),
  cat(10, "Renda extra", null),
]

const C = Object.fromEntries(mockCategories.map((c) => [c.name, c.id]))
const [NU, ITAU, CASH] = mockAccounts.map((a) => a.id)

type Template = {
  day: number
  kind: "in" | "out"
  cents: number
  desc: string
  category: string
  account: string
  method: string
}

// One month of realistic activity. Amounts get a small deterministic variation per month.
const TEMPLATES: Template[] = [
  { day: 5, kind: "in", cents: 780_000, desc: "Salário — Empresa Alfa Ltda.", category: "Salário", account: ITAU, method: "Transferência" },
  { day: 8, kind: "out", cents: 195_000, desc: "Aluguel", category: "Moradia", account: ITAU, method: "Boleto" },
  { day: 8, kind: "out", cents: 48_000, desc: "Condomínio", category: "Moradia", account: ITAU, method: "Boleto" },
  { day: 12, kind: "out", cents: 14_200, desc: "Conta de luz — Enel", category: "Moradia", account: NU, method: "Débito automático" },
  { day: 15, kind: "out", cents: 11_990, desc: "Internet — Vivo Fibra", category: "Moradia", account: NU, method: "Débito automático" },
  { day: 3, kind: "out", cents: 5_590, desc: "Netflix", category: "Assinaturas", account: NU, method: "Cartão" },
  { day: 6, kind: "out", cents: 2_190, desc: "Spotify", category: "Assinaturas", account: NU, method: "Cartão" },
  { day: 10, kind: "out", cents: 3_990, desc: "Amazon Prime", category: "Assinaturas", account: NU, method: "Cartão" },
  { day: 2, kind: "out", cents: 28_450, desc: "Supermercado Pão de Açúcar", category: "Mercado", account: NU, method: "Cartão" },
  { day: 9, kind: "out", cents: 31_870, desc: "Atacadão — compras do mês", category: "Mercado", account: NU, method: "Cartão" },
  { day: 16, kind: "out", cents: 19_640, desc: "Hortifruti da esquina", category: "Mercado", account: CASH, method: "Dinheiro" },
  { day: 23, kind: "out", cents: 27_300, desc: "Supermercado Extra", category: "Mercado", account: NU, method: "Cartão" },
  { day: 4, kind: "out", cents: 8_900, desc: "Almoço — Restaurante Dona Lucinha", category: "Restaurantes", account: NU, method: "Cartão" },
  { day: 11, kind: "out", cents: 12_750, desc: "Jantar — Outback", category: "Restaurantes", account: NU, method: "Cartão" },
  { day: 19, kind: "out", cents: 5_600, desc: "iFood — pizza de sexta", category: "Restaurantes", account: NU, method: "Cartão" },
  { day: 7, kind: "out", cents: 4_820, desc: "Uber — casa ao trabalho", category: "Transporte", account: NU, method: "Cartão" },
  { day: 14, kind: "out", cents: 18_000, desc: "Combustível — Posto Shell", category: "Transporte", account: ITAU, method: "Débito" },
  { day: 21, kind: "out", cents: 7_500, desc: "Estacionamento mensal", category: "Transporte", account: CASH, method: "Dinheiro" },
  { day: 13, kind: "out", cents: 12_900, desc: "Farmácia Drogasil", category: "Saúde", account: NU, method: "Cartão" },
  { day: 17, kind: "out", cents: 8_000, desc: "Cinema + pipoca", category: "Lazer", account: NU, method: "Cartão" },
  { day: 22, kind: "out", cents: 15_000, desc: "Show — ingressos", category: "Lazer", account: NU, method: "Cartão" },
  { day: 1, kind: "out", cents: 45_000, desc: "Mensalidade da pós-graduação", category: "Educação", account: ITAU, method: "Boleto" },
  { day: 20, kind: "in", cents: 120_000, desc: "Freelance — identidade visual", category: "Renda extra", account: NU, method: "Pix" },
]

/** Six months of transactions ending today; the current month stops at today's date. */
export function buildMockTransactions(now: string): TransactionRow[] {
  const today = dayOf(now)
  const currentMonth = today.slice(0, 7)
  const rows: TransactionRow[] = []
  for (let back = 5; back >= 0; back -= 1) {
    const month = shiftMonth(currentMonth, -back)
    TEMPLATES.forEach((t, index) => {
      // Only some months get the freelance income, and values drift a little.
      if (t.category === "Renda extra" && back % 2 === 1) return
      const day = `${month}-${String(t.day).padStart(2, "0")}`
      if (day > today) return
      const drift = t.kind === "out" && t.category !== "Moradia" ? 1 + (((back * 7 + index * 3) % 9) - 4) / 50 : 1
      rows.push({
        id: `t${back}${String(index).padStart(2, "0")}00000-0000-4000-8000-000000000000`,
        user_id: USER,
        account_id: t.account,
        category_id: C[t.category],
        kind: t.kind,
        amount_cents: Math.round((t.cents * drift) / 10) * 10,
        occurred_on: day,
        method: t.method,
        description: t.desc,
        source: index % 5 === 0 ? "open_finance" : "manual",
        created_at: stamp.created_at,
        updated_at: stamp.updated_at,
      })
    })
  }
  return rows.sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
}

export function buildMockBills(now: string): RecurringBillRow[] {
  const month = dayOf(now).slice(0, 7)
  const prev = shiftMonth(month, -1)
  const bill = (n: number, name: string, cents: number, day: number, category: string, paid: boolean): RecurringBillRow => ({
    id: `b0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
    user_id: USER,
    name,
    amount_cents: cents,
    due_day: day,
    category_id: C[category],
    active: true,
    last_paid_month: paid ? month : prev,
    ...stamp,
  })
  return [
    bill(1, "Aluguel", 195_000, 8, "Moradia", true),
    bill(2, "Condomínio", 48_000, 8, "Moradia", true),
    bill(3, "Internet — Vivo Fibra", 11_990, 15, "Moradia", false),
    bill(4, "Conta de luz — Enel", 14_200, 12, "Moradia", true),
    bill(5, "Netflix", 5_590, 3, "Assinaturas", true),
    bill(6, "Spotify", 2_190, 6, "Assinaturas", true),
    bill(7, "Academia Smart Fit", 12_990, 27, "Saúde", false),
    bill(8, "Plano de saúde Unimed", 68_000, 28, "Saúde", false),
    bill(9, "Mensalidade da pós", 45_000, 1, "Educação", true),
  ]
}

export function buildMockGoals(now: string): FinancialGoalRow[] {
  const year = Number(dayOf(now).slice(0, 4))
  const goal = (n: number, name: string, current: number, target: number, deadline: string | null): FinancialGoalRow => ({
    id: `g0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
    user_id: USER,
    name,
    current_cents: current,
    target_cents: target,
    deadline,
    ...stamp,
  })
  return [
    goal(1, "Reserva de emergência", 1_240_000, 2_000_000, `${year + 1}-06-30`),
    goal(2, "Viagem para Florianópolis", 320_000, 600_000, `${year}-12-15`),
    goal(3, "Notebook novo", 210_000, 550_000, `${year + 1}-03-31`),
  ]
}
