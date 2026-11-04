// What the person decides about an account beyond the columns that exist today (name, institution, opening balance): its kind, icon,
// color, whether it is archived and where it sits in the list. localStorage adapter behind `AccountMetaRepo` until
// supabase/migrations/20261109000002_finance_account_meta.sql is applied (prepared, NOT applied). Accounts with no entry are active
// banks in creation order, so nothing breaks for anyone who never touches this.

import { swatchSchema, type SwatchId } from "@/lib/swatches"

export const ACCOUNT_KINDS = ["bank", "wallet", "card", "savings"] as const
export type AccountKind = (typeof ACCOUNT_KINDS)[number]
export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = { bank: "Banco", wallet: "Carteira", card: "Cartão", savings: "Poupança" }

export const ACCOUNT_ICON_KEYS = ["landmark", "wallet", "card", "piggy", "banknote"] as const
export type AccountIconKey = (typeof ACCOUNT_ICON_KEYS)[number]
export const ACCOUNT_ICON_LABELS: Record<AccountIconKey, string> = { landmark: "Banco", wallet: "Carteira", card: "Cartão", piggy: "Cofrinho", banknote: "Dinheiro" }
/** The icon an account shows until the person picks another one. */
export const DEFAULT_ICON: Record<AccountKind, AccountIconKey> = { bank: "landmark", wallet: "wallet", card: "card", savings: "piggy" }

export type AccountMeta = { kind?: AccountKind; icon?: AccountIconKey; color?: SwatchId; archived?: boolean }
export type AccountLayout = { meta: Record<string, AccountMeta>; order: string[] }

export type AccountMetaRepo = {
  load(): AccountLayout
  save(layout: AccountLayout): void
}

const KEY = "organizzou:financas-account-meta"

const isKind = (v: unknown): v is AccountKind => typeof v === "string" && (ACCOUNT_KINDS as readonly string[]).includes(v)
const isIcon = (v: unknown): v is AccountIconKey => typeof v === "string" && (ACCOUNT_ICON_KEYS as readonly string[]).includes(v)

export const localAccountMetaRepo: AccountMetaRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { meta?: Record<string, Record<string, unknown>>; order?: unknown }
      const meta: Record<string, AccountMeta> = {}
      for (const [id, raw] of Object.entries(parsed.meta ?? {})) {
        const color = swatchSchema.safeParse(raw.color)
        meta[id] = { kind: isKind(raw.kind) ? raw.kind : undefined, icon: isIcon(raw.icon) ? raw.icon : undefined, color: color.success ? color.data : undefined, archived: raw.archived === true }
      }
      return { meta, order: Array.isArray(parsed.order) ? parsed.order.filter((id): id is string => typeof id === "string") : [] }
    } catch {
      return { meta: {}, order: [] }
    }
  },
  save(layout) {
    try {
      localStorage.setItem(KEY, JSON.stringify(layout))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  },
}

/** Accounts in the saved order; the ones the order does not know yet follow in their own (creation) order. */
export function orderAccounts<T extends { id: string }>(accounts: T[], order: string[]): T[] {
  const known = order.map((id) => accounts.find((a) => a.id === id)).filter((a): a is T => Boolean(a))
  return [...known, ...accounts.filter((a) => !order.includes(a.id))]
}
