"use client"

import { FinancasScreen, type FinanceInitial } from "@/components/finance/financas-screen"
import type { AccountRow, CategoryRow, FinancialGoalRow, RecurringBillRow, TransactionRow } from "@/features/finance/types"

const U = "00000000-0000-4000-8000-000000000001"
const STAMP = "2026-06-01T00:00:00Z"
export const CAT = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const ACC = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`

function ymd(nowMs: number, offsetDays: number) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date(nowMs + offsetDays * 86_400_000))
}

function build(nowIso: string): FinanceInitial {
  const now = new Date(nowIso).getTime()
  const today = ymd(now, 0)
  const month = today.slice(0, 7)
  const accounts: AccountRow[] = [
    { id: ACC(1), user_id: U, name: "Nubank", institution: "Nubank", opening_balance_cents: 2_520_000, created_at: STAMP, updated_at: STAMP },
    { id: ACC(2), user_id: U, name: "Itaú", institution: "Itaú", opening_balance_cents: 1_480_000, created_at: STAMP, updated_at: STAMP },
    { id: ACC(3), user_id: U, name: "Carteira", institution: "Dinheiro", opening_balance_cents: 30_000, created_at: STAMP, updated_at: STAMP },
    { id: ACC(4), user_id: U, name: "Poupança", institution: "Caixa", opening_balance_cents: 4_200_000, created_at: STAMP, updated_at: STAMP },
  ]
  const cat = (n: number, name: string, limit: number | null): CategoryRow => ({ id: CAT(n), user_id: U, name, monthly_limit_cents: limit, created_at: STAMP, updated_at: STAMP })
  const categories: CategoryRow[] = [
    cat(1, "Moradia", 250_000),
    cat(2, "Mercado", 120_000),
    cat(3, "Restaurantes", 60_000),
    cat(4, "Transporte", 40_000),
    cat(5, "Saúde", 30_000),
    cat(6, "Lazer", 25_000),
    cat(7, "Assinaturas", 15_000),
    cat(8, "Salário", null),
    cat(9, "Renda extra", null),
  ]
  let n = 0
  const tx = (offset: number, kind: "in" | "out", cents: number, description: string, category: number, account = 1): TransactionRow => {
    n += 1
    return { id: `f0000000-0000-4000-8000-${String(n).padStart(12, "0")}`, user_id: U, account_id: ACC(account), category_id: CAT(category), kind, amount_cents: cents, occurred_on: ymd(now, offset), method: null, description, source: "manual", created_at: STAMP, updated_at: STAMP }
  }
  const transactions: TransactionRow[] = [
    tx(0, "out", 5_890, "Padaria da esquina", 3),
    tx(0, "out", 18_450, "Mercado do bairro", 2),
    tx(-1, "out", 9_732, "Uber para o aeroporto", 4),
    tx(-1, "out", 4_500, "Farmácia", 5, 3),
    tx(-2, "out", 25_000, "Cinema e jantar", 6, 2),
    tx(-3, "in", 450_000, "Salário", 8, 2),
    tx(-3, "out", 12_990, "Netflix e Spotify", 7),
    tx(-5, "out", 38_700, "Feira e mercado", 2),
    // earlier months, for the chart
    ...[1, 2, 3, 4, 5].flatMap((m) => [tx(-30 * m, "in", 450_000 + m * 10_000, "Salário", 8, 2), tx(-30 * m + 2, "out", 210_000 + m * 8_000, "Aluguel e contas", 1, 2), tx(-30 * m + 4, "out", 90_000 + m * 3_000, "Mercado", 2)]),
  ].filter((t) => t.occurred_on <= today)
  const bill = (id: number, name: string, cents: number, day: number, category: number, paid: boolean): RecurringBillRow => ({ id: `b0000000-0000-4000-8000-${String(id).padStart(12, "0")}`, user_id: U, name, amount_cents: cents, due_day: day, category_id: CAT(category), active: true, last_paid_month: paid ? month : null, created_at: STAMP, updated_at: STAMP })
  const d = Number(today.slice(8, 10))
  const dayFrom = (offset: number) => Math.min(28, Math.max(1, d + offset))
  const bills: RecurringBillRow[] = [
    bill(1, "Aluguel", 180_000, 5, 1, true),
    bill(2, "Internet", 11_990, dayFrom(-3), 7, false),
    bill(3, "Energia elétrica", 18_740, dayFrom(2), 1, false),
    bill(4, "Plano de saúde", 54_000, dayFrom(4), 5, false),
    bill(5, "Netflix", 5_590, dayFrom(9), 7, false),
    bill(6, "Academia", 12_990, 3, 5, true),
    bill(7, "Condomínio", 42_000, dayFrom(12), 1, false),
  ]
  const goal = (id: number, name: string, target: number, current: number, deadline: string | null): FinancialGoalRow => ({ id: `90000000-0000-4000-8000-${String(id).padStart(12, "0")}`, user_id: U, name, target_cents: target, current_cents: current, deadline, created_at: STAMP, updated_at: STAMP })
  const goals: FinancialGoalRow[] = [
    goal(1, "Reserva de emergência", 2_000_000, 1_240_000, "2027-06-30"),
    goal(2, "Viagem de fim de ano", 1_000_000, 240_000, "2026-12-20"),
    goal(3, "Notebook novo", 800_000, 800_000, null),
    goal(4, "Entrada do apartamento", 3_450_000 - 2_650_000 + 1_000_000, 410_000, "2028-01-10"),
  ]
  return { accounts, categories, transactions, bills, goals }
}

export function FixtureFinancas({ nowIso }: { nowIso: string }) {
  return <FinancasScreen nowIso={nowIso} initial={build(nowIso)} memory />
}
