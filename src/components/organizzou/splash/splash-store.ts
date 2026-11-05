import { SPLASH_IDLE, splashReduce, type SplashState } from "@/lib/splash-machine"

import { splashLog } from "./splash-debug"

/**
 * The one place where "is the splash still needed?" lives, in memory of the current document. Writers: the login code (markPending, before it
 * navigates), the dashboard shell (markReady, from an effect on mount) and whoever removes the overlay (markDismissed). Readers: the hand-off
 * overlay and the server-rendered splash's controller. No selectors, no skeleton detection, no pathname checks.
 */
let machine: SplashState = SPLASH_IDLE
// The shell can mount before the splash starts waiting (a resumed document renders both in the same commit): remembered here.
let shellMounted = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const splash = {
  /** A login is about to navigate. `adopt`: a resumed document starts waiting for a shell that may already be there. */
  markPending({ adopt = false, at = Date.now() }: { adopt?: boolean; at?: number } = {}) {
    if (!adopt) shellMounted = false
    machine = splashReduce(machine, "pending", at)
    splashLog("overlay-marked-pending", { adopt })
    if (adopt && shellMounted) machine = splashReduce(machine, "ready", Date.now())
    emit()
  },
  /** The dashboard shell has mounted. */
  markReady() {
    shellMounted = true
    machine = splashReduce(machine, "ready", Date.now())
    splashLog("overlay-marked-ready", { phase: machine.phase })
    emit()
  },
  markDismissed() {
    machine = splashReduce(machine, "dismissed", Date.now())
    emit()
  },
  state: () => machine,
  /** True once a dashboard shell has mounted in this document. */
  shellMounted: () => shellMounted,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },
}
