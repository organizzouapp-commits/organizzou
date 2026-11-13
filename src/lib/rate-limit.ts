// A small sliding-window rate limit kept in memory (per server instance). It slows abuse down (exports, e-mail codes, reports); the places
// that need a hard guarantee also keep their counters in the database. Pure apart from the module-level store.

export type Limit = { max: number; windowMs: number }

/** Records an attempt for `key` and says whether it is allowed; `retryAfterMs` tells when the oldest attempt leaves the window. */
export function hit(store: Map<string, number[]>, key: string, limit: Limit, now = Date.now()): { ok: true } | { ok: false; retryAfterMs: number } {
  const recent = (store.get(key) ?? []).filter((t) => now - t < limit.windowMs)
  if (recent.length >= limit.max) {
    store.set(key, recent)
    return { ok: false, retryAfterMs: limit.windowMs - (now - recent[0]) }
  }
  recent.push(now)
  store.set(key, recent)
  // Keeps the store from growing forever: forget keys that have gone quiet.
  if (store.size > 5000) for (const [k, times] of store) if (times.every((t) => now - t >= limit.windowMs)) store.delete(k)
  return { ok: true }
}

/** A named in-memory limiter: `const limiter = createLimiter({ max: 3, windowMs: 3_600_000 })`, then `limiter.hit(userId)`. */
export function createLimiter(limit: Limit) {
  const store = new Map<string, number[]>()
  return { hit: (key: string, now?: number) => hit(store, key, limit, now) }
}
