import { TZDate } from "@date-fns/tz"
import { format } from "date-fns"

export const MOCK_TIMEZONE = "America/Sao_Paulo"

/** ISO instant for "now + offsetDays" at the given São Paulo wall-clock time. */
export function at(now: Date | string, offsetDays: number, time = "12:00") {
  const base = new TZDate(new Date(now), MOCK_TIMEZONE)
  const [hours, minutes] = time.split(":").map(Number)
  const target = new TZDate(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays, hours, minutes, 0, MOCK_TIMEZONE)
  return new Date(target.getTime()).toISOString()
}

/** "yyyy-MM-dd" for "now + offsetDays" in São Paulo. */
export function dayOf(now: Date | string, offsetDays = 0) {
  return format(new TZDate(new Date(at(now, offsetDays)), MOCK_TIMEZONE), "yyyy-MM-dd")
}

let counter = 0
/** Deterministic-looking uuid-shaped id for rows created in memory. */
export function mockId(prefix = "m") {
  counter += 1
  const n = counter.toString(16).padStart(12, "0")
  return `00000000-${prefix.padEnd(4, "0").slice(0, 4)}-4000-8000-${n}`
}
