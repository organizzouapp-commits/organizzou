// What the Cofre can say about its own contents without ever showing them: how healthy the passwords are, what repeats, what is weak.
// Pure and local: it runs on the decrypted items in memory and returns only counts and item ids.
import { passwordStrength } from "./passwords"
import type { VaultItem, VaultItemType } from "./types"

export type VaultHealth = {
  items: number
  byType: Record<VaultItemType, number>
  /** Items of the "Senha" type that have a password. */
  passwords: number
  /** Passwords that are strong AND not used by another item. */
  strongUnique: number
  /** 0–100, or null when there is no password to judge. */
  percent: number | null
  weakIds: string[]
  /** Groups of items that share the same password. */
  reusedGroups: string[][]
  /** How many items take part in a repeated password. */
  reusedItems: number
  /** Ids of the items whose password is not shared with any other item. */
  uniqueIds: string[]
}

const EMPTY_TYPES: Record<VaultItemType, number> = { login: 0, card: 0, document: 0, secure_note: 0 }

export function vaultHealth(items: Pick<VaultItem, "id" | "type" | "password">[]): VaultHealth {
  const byType = { ...EMPTY_TYPES }
  for (const item of items) byType[item.type] += 1
  const withPassword = items.filter((i) => i.type === "login" && i.password)

  const groups = new Map<string, string[]>()
  for (const item of withPassword) groups.set(item.password as string, [...(groups.get(item.password as string) ?? []), item.id])
  const reusedGroups = [...groups.values()].filter((ids) => ids.length > 1)
  const reused = new Set(reusedGroups.flat())

  const weakIds = withPassword.filter((i) => passwordStrength(i.password as string) === "weak").map((i) => i.id)
  const strongUnique = withPassword.filter((i) => passwordStrength(i.password as string) === "strong" && !reused.has(i.id)).length
  return {
    items: items.length,
    byType,
    passwords: withPassword.length,
    strongUnique,
    percent: withPassword.length === 0 ? null : Math.round((strongUnique / withPassword.length) * 100),
    weakIds,
    reusedGroups,
    reusedItems: reused.size,
    uniqueIds: withPassword.filter((i) => !reused.has(i.id)).map((i) => i.id),
  }
}

/** "hoje", "há 3 dias", "há 2 meses", "há 1 ano": how long ago an instant was, in words. */
export function ageLabel(iso: string, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000))
  if (days === 0) return "hoje"
  if (days === 1) return "ontem"
  if (days < 30) return `há ${days} dias`
  if (days < 365) {
    const months = Math.max(1, Math.floor(days / 30))
    return months === 1 ? "há 1 mês" : `há ${months} meses`
  }
  const years = Math.floor(days / 365)
  return years === 1 ? "há 1 ano" : `há ${years} anos`
}

/** "9:05": whole seconds as m:ss for the auto-lock countdown. */
export function countdownText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}
