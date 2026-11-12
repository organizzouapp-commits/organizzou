// Installment bills ("Parcelada") in Contas fixas: a fixed bill that repeats monthly for exactly N months and then ends by itself.
// One bill row stays the series (name, category, the installment amount); what makes it an installment lives in `InstallmentMeta`, kept in
// localStorage behind `BillMetaRepo` until supabase/migrations/20261112000003_installment_bills.sql is applied (prepared, NOT applied).
// Everything here is pure apart from that adapter.
import { addMonths, format, getDaysInMonth, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

import { formatBRL } from "@/lib/money"

import type { BillStatus, BillView } from "./stats"
import type { RecurringBillRow } from "./types"

export const MIN_INSTALLMENTS = 2
export const MAX_INSTALLMENTS = 60

export type InstallmentMeta = {
  total: number
  /** "yyyy-MM" of the first installment. */
  firstMonth: string
  /** The day the person chose (1-31); a shorter month clamps to its last day. */
  firstDay: number
  /** Months ("yyyy-MM") whose installment was paid: paying one never marks another. */
  paidMonths: string[]
  /** Installments removed from the series on their own ("Só esta parcela"). */
  skipped: string[]
  /** Amount of one installment when it differs from the bill's (edited "Só esta" / "Esta e as próximas"), by month. */
  amounts: Record<string, number>
}

export type BillMetaMap = Record<string, InstallmentMeta>

export type AmountMode = "installment" | "total"

const shift = (month: string, offset: number) => format(addMonths(parseISO(`${month}-01`), offset), "yyyy-MM")

/** Whole months from `from` to `to` ("yyyy-MM" both). */
export const monthsBetween = (from: string, to: string) => (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)))

/** The due day in `month`: the chosen day, or the last day of a shorter month (31 in February -> 28 or 29). */
export function clampDay(month: string, day: number): number {
  return Math.min(Math.max(1, day), getDaysInMonth(parseISO(`${month}-01`)))
}

/** 1-based position of `month` in the series, or null when it is before the start, after the end, or was skipped. */
export function installmentIndex(meta: InstallmentMeta, month: string): number | null {
  const index = monthsBetween(meta.firstMonth, month) + 1
  if (index < 1 || index > meta.total || meta.skipped.includes(month)) return null
  return index
}

/** The last month of the series. */
export const lastMonth = (meta: InstallmentMeta) => shift(meta.firstMonth, meta.total - 1)

export const installmentAmount = (bill: Pick<RecurringBillRow, "amount_cents">, meta: InstallmentMeta, month: string) => meta.amounts[month] ?? bill.amount_cents

/** The one installment due in `month` as a bill view (with that month's amount and clamped due day), or null when the series has none then. */
export function installmentView(bill: RecurringBillRow, meta: InstallmentMeta, month: string, today: string): (BillView & { installment: { index: number; total: number } }) | null {
  const index = installmentIndex(meta, month)
  if (index === null) return null
  const day = clampDay(month, meta.firstDay)
  const dueOn = `${month}-${String(day).padStart(2, "0")}`
  const daysLeft = Math.round((parseISO(dueOn).getTime() - parseISO(today).getTime()) / 86_400_000)
  let status: BillStatus = "upcoming"
  if (meta.paidMonths.includes(month)) status = "paid"
  else if (daysLeft < 0) status = "overdue"
  else if (daysLeft <= 5) status = "soon"
  return { bill: { ...bill, amount_cents: installmentAmount(bill, meta, month), due_day: day }, status, daysLeft, dueOn, installment: { index, total: meta.total } }
}

/** What is left of the series from `month` on (that month included): installments not paid or skipped, and their total. */
export function remainingFrom(bill: Pick<RecurringBillRow, "amount_cents">, meta: InstallmentMeta, month: string): { count: number; cents: number } {
  let count = 0
  let cents = 0
  for (let i = 0; i < meta.total; i++) {
    const m = shift(meta.firstMonth, i)
    if (m < month || meta.skipped.includes(m) || meta.paidMonths.includes(m)) continue
    count += 1
    cents += installmentAmount(bill, meta, m)
  }
  return { count, cents }
}

/** "Parcela 3/10". */
export const installmentLabel = (index: number, total: number) => `Parcela ${index}/${total}`

/** The per-installment amount from what was typed: the installment itself, or the total split evenly (rounded to the cent). */
export function installmentCents(mode: AmountMode, typedCents: number, count: number): number {
  return mode === "total" ? Math.round(typedCents / count) : typedCents
}

const monthYear = (month: string) => format(parseISO(`${month}-01`), "MMM/yyyy", { locale: ptBR }).replace(".", "")

/** "10x de R$ 150,00 · de mar/2027 a dez/2027". */
export function installmentPreview(count: number, perCents: number, firstMonth: string): string {
  return `${count}x de ${formatBRL(perCents)} · de ${monthYear(firstMonth)} a ${monthYear(shift(firstMonth, count - 1))}`
}

export type Scope = "this" | "following" | "all"

/** Removes installments from the series: only `month`, `month` and the next ones (the series ends before it), or all (null = delete the bill). */
export function removeInstallments(meta: InstallmentMeta, month: string, scope: Scope): InstallmentMeta | null {
  const index = installmentIndex(meta, month)
  if (index === null || scope === "all") return null
  if (scope === "this") return { ...meta, skipped: [...meta.skipped, month] }
  return index === 1 ? null : { ...meta, total: index - 1, paidMonths: meta.paidMonths.filter((m) => m < month), skipped: meta.skipped.filter((m) => m < month) }
}

/** A new amount for `month` only, for `month` and the following ones, or for the whole series (the bill's own amount, so the overrides go). */
export function setInstallmentAmount(meta: InstallmentMeta, month: string, scope: Scope, cents: number): { meta: InstallmentMeta; billCents: number | null } {
  if (scope === "all") return { meta: { ...meta, amounts: {} }, billCents: cents }
  const amounts = { ...meta.amounts }
  const from = scope === "this" ? 0 : (installmentIndex(meta, month) ?? 1) - 1
  const until = scope === "this" ? 1 : meta.total - from
  for (let i = 0; i < until; i++) amounts[shift(scope === "this" ? month : shift(meta.firstMonth, from), i)] = cents
  return { meta: { ...meta, amounts }, billCents: null }
}

export function newInstallmentMeta(count: number, firstDate: string): InstallmentMeta {
  return { total: count, firstMonth: firstDate.slice(0, 7), firstDay: Number(firstDate.slice(8, 10)), paidMonths: [], skipped: [], amounts: {} }
}

/** Paying or reopening one installment touches that month only. */
export const setInstallmentPaid = (meta: InstallmentMeta, month: string, paid: boolean): InstallmentMeta => ({ ...meta, paidMonths: paid ? [...new Set([...meta.paidMonths, month])] : meta.paidMonths.filter((m) => m !== month) })

// ---------------------------------------------------------------- storage (fallback until the migration is applied)

export interface BillMetaRepo {
  load(): BillMetaMap
  save(map: BillMetaMap): void
}

const KEY = "organizzou:financas-installments"
const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}$/.test(v)

export function parseBillMeta(raw: unknown): BillMetaMap {
  const out: BillMetaMap = {}
  if (!raw || typeof raw !== "object") return out
  for (const [id, value] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
    if (!value || typeof value !== "object") continue
    const total = Number(value.total)
    const firstDay = Number(value.firstDay)
    if (!Number.isInteger(total) || total < 1 || total > MAX_INSTALLMENTS || !isMonth(value.firstMonth) || !Number.isInteger(firstDay) || firstDay < 1 || firstDay > 31) continue
    const amounts: Record<string, number> = {}
    for (const [m, cents] of Object.entries((value.amounts as Record<string, unknown>) ?? {})) if (isMonth(m) && Number.isInteger(cents) && (cents as number) > 0) amounts[m] = cents as number
    out[id] = {
      total,
      firstMonth: value.firstMonth,
      firstDay,
      paidMonths: Array.isArray(value.paidMonths) ? value.paidMonths.filter(isMonth) : [],
      skipped: Array.isArray(value.skipped) ? value.skipped.filter(isMonth) : [],
      amounts,
    }
  }
  return out
}

export const localBillMetaRepo: BillMetaRepo = {
  load() {
    try {
      return parseBillMeta(JSON.parse(localStorage.getItem(KEY) ?? "{}"))
    } catch {
      return {}
    }
  },
  save(map) {
    try {
      localStorage.setItem(KEY, JSON.stringify(map))
    } catch {
      // Private mode: the series just does not survive the visit.
    }
  },
}
