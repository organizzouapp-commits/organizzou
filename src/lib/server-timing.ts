/**
 * Where the time of a dashboard request goes. Wrap a promise with `timed("label", promise)`: its duration is remembered for the current request and
 * `reportTimings()` prints them (and says whether they overlapped, i.e. ran in parallel, or ran one after the other). Printed to the server console
 * in development, and in production when ORG_TIMING=1 (set it for a measuring run, unset it after). The middleware also sends its own part as a
 * `Server-Timing` header (visible in the browser's Network tab). Nothing here changes what the code does.
 */
import { AsyncLocalStorage } from "node:async_hooks"

type Entry = { label: string; start: number; end: number }
const store = new AsyncLocalStorage<Entry[]>()

const enabled = () => process.env.NODE_ENV !== "production" || process.env.ORG_TIMING === "1"

/** Runs `fn` with a fresh list of timings for this request (the dashboard layout does). */
export function withTimings<T>(fn: () => Promise<T>): Promise<T> {
  return enabled() ? store.run([], fn) : fn()
}

export async function timed<T>(label: string, promise: PromiseLike<T> | T): Promise<T> {
  const list = store.getStore()
  if (!list) return promise
  const start = performance.now()
  try {
    return await promise
  } finally {
    list.push({ label, start, end: performance.now() })
  }
}

/** One line per query plus the verdict: how much of the wall time was serial work. */
export function reportTimings(title: string) {
  const list = store.getStore()
  if (!list?.length) return
  const first = Math.min(...list.map((e) => e.start))
  const last = Math.max(...list.map((e) => e.end))
  const sum = list.reduce((s, e) => s + (e.end - e.start), 0)
  const rows = [...list].sort((a, b) => a.start - b.start).map((e) => `  ${e.label.padEnd(26)} +${(e.start - first).toFixed(0).padStart(5)}ms  ${(e.end - e.start).toFixed(0).padStart(5)}ms`)
  console.log(`[server-timing] ${title}: wall ${(last - first).toFixed(0)}ms, sum of queries ${sum.toFixed(0)}ms (${sum > (last - first) * 1.15 ? "overlapping: some run in parallel" : "serial: one after the other"})\n${rows.join("\n")}`)
}
