// Active sessions, apart from the database: the readable label of a device, the place from the host's own headers, the relative "last seen" and
// the rule that decides when the proxy asks the database again. Pure, so it is tested.
import { deviceLabel } from "@/features/notifications/push"

/** How often a session checks in (and learns it was revoked): once a minute is enough and costs one small call. */
export const CHECK_INTERVAL_SECONDS = 60

export const sessionLabel = (userAgent: string): string => deviceLabel(userAgent)

/** "Campinas, BR" from the headers Vercel adds for free (the city arrives URL-encoded). Null when there is nothing to show. */
export function placeFromHeaders(city: string | null | undefined, country: string | null | undefined): string | null {
  let name = ""
  try {
    name = city ? decodeURIComponent(city).trim() : ""
  } catch {
    name = ""
  }
  const code = (country ?? "").trim().toUpperCase().slice(0, 2)
  const parts = [name, code].filter(Boolean)
  return parts.length > 0 ? parts.join(", ").slice(0, 120) : null
}

/** "agora", "há 5 minutos", "há 2 horas", "há 3 dias": the list never shows a clock time of someone's activity. */
export function lastSeenText(lastSeen: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(lastSeen)) / 1000))
  if (seconds < 90) return "agora"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `há ${minutes} minutos`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`
  const days = Math.round(hours / 24)
  return `há ${days} ${days === 1 ? "dia" : "dias"}`
}

export type SessionListItem = { id: string; label: string; place: string | null; createdAt: string; lastSeenAt: string; current: boolean }

/** The current device first, then the others by recent activity. */
export function orderSessions(items: SessionListItem[]): SessionListItem[] {
  return [...items].sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
}
