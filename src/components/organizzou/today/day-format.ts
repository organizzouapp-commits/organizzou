/** Small pt-BR formatters for the "Seu dia" timeline. Everything is in America/Sao_Paulo. */
export const TZ = "America/Sao_Paulo"

export const clock = (value: string | number) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value))
export const hourOf = (ms: number) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(ms))) % 24
/** "yyyy-MM-dd" of an instant in São Paulo. */
export const dayKey = (value: string | number) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date(value))

export const number = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })

/** "1 h 30", "45 min". */
export const durationText = (min?: number) => (min ? (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ""}` : `${min} min`) : null)

/** "1 h 01", "25 min": time left, for the item happening now. */
export function remainingText(ms: number) {
  const minutes = Math.max(0, Math.ceil(ms / 60000))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`
}

/** "há 14 h", "há 20 min", "há 2 dias". */
export function agoText(sinceMs: number, nowMs: number) {
  const minutes = Math.max(1, Math.round((nowMs - sinceMs) / 60000))
  if (minutes < 60) return `há ${minutes} min`
  if (minutes < 24 * 60) return `há ${Math.floor(minutes / 60)} h`
  const days = Math.floor(minutes / (24 * 60))
  return `há ${days} ${days === 1 ? "dia" : "dias"}`
}

/** "Segunda, 2 de novembro". */
export function dayTitle(ms: number) {
  const text = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(ms)).replace("-feira", "")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Step of the "+" button for a quantity habit: a natural amount per unit, never a fraction of the target. */
export function stepFor(unit: string, target: number) {
  if (unit === "L") return 0.25
  if (unit === "min") return 10
  if (unit === "páginas") return 5
  return Math.max(1, Math.round(target / 4))
}

/** "250 ml" for a litre habit, otherwise the number and the unit. */
export function stepLabel(unit: string, target: number) {
  const step = stepFor(unit, target)
  return unit === "L" ? `${Math.round(step * 1000)} ml` : `${number(step)} ${unit}`.trim()
}
