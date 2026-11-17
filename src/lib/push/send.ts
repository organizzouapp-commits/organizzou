import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import * as webpush from "web-push"

import { classifyPushError, endpointHost, type FailureCounts } from "@/lib/push/failures"
import { cleanKey, normalizeSubject, vapidProblem, type VapidProblem } from "@/lib/push/vapid"

// Sends web push. The VAPID private key is read here, on the server, and never leaves it: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY (the public key is
// also what the browser needs to subscribe; it is public by design) and VAPID_SUBJECT (mailto: or https, defaults to the support address).
// Subscriptions the push service no longer knows (404 / 410) are deleted. Every failure is counted by reason and logged as
// "[push] send_failed status=... reason=... host=..." (the push service's host only, never an endpoint, key, token or payload).

/** `sticky`: the banner stays until it is clicked (requireInteraction), for the test and for reminders with a due time. */
export type PushPayload = { title: string; body: string; url: string; tag?: string; sticky?: boolean }

/** A notification that is hours late is worse than none: the push service drops it after this long. */
export const PUSH_TTL_SECONDS = 60 * 60
export type PushResult = {
  /** Subscriptions the push service accepted (201). Accepted is not displayed: the browser still has to show it. */
  sent: number
  removed: number
  failed: number
  /** Subscriptions found for the person (or the one asked for). */
  devices: number
  /** Failures by reason, e.g. { vapid_rejected: 1 }. */
  failures: FailureCounts
  /** The server's own key configuration is broken: nothing was attempted. */
  problem?: VapidProblem
}
type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string }

export const vapidPublicKey = () => cleanKey(process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
const vapidPrivateKey = () => cleanKey(process.env.VAPID_PRIVATE_KEY)

/** The contact the push services can reach: mailto: or https. A bare e-mail gets its mailto:; a broken value falls back to the support address. */
export function vapidSubject(): string {
  const { subject, valid } = normalizeSubject(process.env.VAPID_SUBJECT)
  if (!valid) console.warn("[push] vapid_subject_invalid: VAPID_SUBJECT must be mailto:... or an https URL; using the support address")
  return subject
}

/** What is wrong with the server's keys, or null. */
export const vapidConfigProblem = (): VapidProblem | null => vapidProblem({ publicKey: vapidPublicKey(), privateKey: vapidPrivateKey() })

export const pushConfigured = (): boolean => vapidConfigProblem() === null

let configuredFor = ""
function configure() {
  const subject = vapidSubject()
  const signature = `${subject}|${vapidPublicKey().length}|${vapidPrivateKey().length}`
  if (configuredFor === signature) return
  webpush.setVapidDetails(subject, vapidPublicKey(), vapidPrivateKey())
  configuredFor = signature
}

const empty = (extra: Partial<PushResult> = {}): PushResult => ({ sent: 0, removed: 0, failed: 0, devices: 0, failures: {}, ...extra })

/**
 * Sends to every subscription of one person (or only to subscription row `only`). `db` must be allowed to read and delete those rows (the
 * person's own session, or the secret client). Every push is sent with urgency "high" (delivered at once, even to a phone that is dozing)
 * and a one hour TTL.
 */
export async function sendToUser(db: SupabaseClient, userId: string, payload: PushPayload, only?: string): Promise<PushResult> {
  const problem = vapidConfigProblem()
  if (problem) {
    console.warn(`[push] not_configured problem=${problem}`)
    return empty({ problem })
  }
  configure()
  let query = db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId)
  if (only) query = query.eq("id", only)
  const { data, error } = await query
  if (error || !data) {
    console.warn(`[push] subscriptions_unreadable db=${error?.code ?? "no_data"}`)
    return empty()
  }
  const rows = data as SubscriptionRow[]
  const result = empty({ devices: rows.length })
  const body = JSON.stringify(payload)
  const gone: string[] = []
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body, { TTL: PUSH_TTL_SECONDS, urgency: "high" })
        result.sent += 1
      } catch (error) {
        const failure = classifyPushError(error)
        console.warn(`[push] send_failed status=${failure.status ?? "none"} reason=${failure.code} host=${endpointHost(row.endpoint)}`)
        result.failures[failure.code] = (result.failures[failure.code] ?? 0) + 1
        if (failure.remove) gone.push(row.id)
        else result.failed += 1
      }
    })
  )
  if (gone.length > 0) {
    await db.from("push_subscriptions").delete().in("id", gone)
    result.removed = gone.length
  }
  return result
}
