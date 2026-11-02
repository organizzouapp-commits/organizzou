import type { UserFilters, UserStatus } from "./data"

type Params = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const oneOf = <T extends string>(value: string | undefined, allowed: readonly T[]): T | null => (allowed.find((a) => a === value) ?? null)
const isDay = (value: string | undefined): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))

export const SORTS = ["name", "email", "plan", "created_at", "last_seen"] as const

/** Everything on the users page lives in the URL: search, filters, sort and page. This turns it into the SQL arguments. */
export function parseUserFilters(sp: Params): UserFilters {
  const search = first(sp.q)?.trim().slice(0, 100)
  const from = first(sp.de)
  const to = first(sp.ate)
  return {
    search: search || null,
    plan: oneOf(first(sp.plano), ["free", "pro"] as const),
    status: oneOf<UserStatus>(first(sp.status), ["active", "suspended", "pending"] as const),
    activity: oneOf(first(sp.atividade), ["active", "inactive"] as const),
    from: isDay(from) ? from : null,
    to: isDay(to) ? to : null,
    sort: oneOf(first(sp.ordem), SORTS) ?? "created_at",
    dir: first(sp.dir) === "asc" ? "asc" : "desc",
  }
}

export function parsePage(sp: Params) {
  const page = Number(first(sp.pagina))
  return Number.isInteger(page) && page >= 1 ? page : 1
}

/** Query string for the users page, keeping the filters. `overrides` replaces single keys; empty values drop the key. */
export function userQuery(filters: UserFilters, page: number, overrides: Record<string, string | null> = {}) {
  const params = new URLSearchParams()
  const set = (key: string, value: string | null | undefined) => {
    if (value) params.set(key, value)
  }
  set("q", filters.search)
  set("plano", filters.plan)
  set("status", filters.status)
  set("atividade", filters.activity)
  set("de", filters.from)
  set("ate", filters.to)
  if (filters.sort !== "created_at") set("ordem", filters.sort)
  if (filters.dir !== "desc") set("dir", filters.dir)
  if (page > 1) set("pagina", String(page))
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value)
    else params.delete(key)
  }
  const query = params.toString()
  return query ? `?${query}` : "?"
}
