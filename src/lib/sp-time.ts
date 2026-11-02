import { TZDate } from "@date-fns/tz"
import { format } from "date-fns"

/** Every "today", "this week" and day boundary in the app is São Paulo time, on the server and in the browser. */
export const SP_TIMEZONE = "America/Sao_Paulo"

/** ISO instant for "now + offsetDays" at the given São Paulo wall-clock time. */
export function at(now: Date | string, offsetDays: number, time = "12:00") {
  const base = new TZDate(new Date(now), SP_TIMEZONE)
  const [hours, minutes] = time.split(":").map(Number)
  const target = new TZDate(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays, hours, minutes, 0, SP_TIMEZONE)
  return new Date(target.getTime()).toISOString()
}

/** "yyyy-MM-dd" for "now + offsetDays" in São Paulo. */
export function dayOf(now: Date | string, offsetDays = 0) {
  return format(new TZDate(new Date(at(now, offsetDays)), SP_TIMEZONE), "yyyy-MM-dd")
}

/** Id for a row created on screen: a random uuid, saved as it is. */
export function newId() {
  return crypto.randomUUID()
}
