// A gentle brake on guessing the master password from this screen: nothing for the first four wrong tries, then a wait that doubles
// (2, 4, 8 … up to 60 seconds). It is only a local, in-memory courtesy: the real protection is the 600 000-iteration key derivation.

/** How long to wait before the next try, given how many wrong tries in a row there were. */
export function unlockDelayMs(failures: number): number {
  if (failures < 5) return 0
  return Math.min(60_000, 1000 * 2 ** (failures - 4))
}

let failures = 0
let blockedUntil = 0

export const unlockBlockedUntil = () => blockedUntil

/** A wrong password: counts it and returns the moment (ms) the next try is allowed (now when there is no wait yet). */
export function recordUnlockFailure(now = Date.now()): number {
  failures += 1
  blockedUntil = now + unlockDelayMs(failures)
  return blockedUntil
}

export function resetUnlockFailures() {
  failures = 0
  blockedUntil = 0
}
