import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import webpush from "web-push"

// Sends web push. The VAPID private key is read here, on the server, and never leaves it: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY (the public key is
// also what the browser needs to subscribe; it is public by design) and VAPID_SUBJECT (mailto:...). Subscriptions the push service no longer
// knows (404 / 410) are deleted.

export type PushPayload = { title: string; body: string; url: string; tag?: string }
export type PushResult = { sent: number; removed: number; failed: number }
type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string }

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

export function pushConfigured(): boolean {
  return Boolean(vapidPublicKey() && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

let configured = false
function configure() {
  if (configured) return
  webpush.setVapidDetails(process.env.VAPID_SUBJECT as string, vapidPublicKey(), process.env.VAPID_PRIVATE_KEY as string)
  configured = true
}

/** Sends to every subscription of one person. `db` must be allowed to read and delete those rows (the person's own session, or the secret client). */
export async function sendToUser(db: SupabaseClient, userId: string, payload: PushPayload, only?: string): Promise<PushResult> {
  const result: PushResult = { sent: 0, removed: 0, failed: 0 }
  if (!pushConfigured()) return result
  configure()
  let query = db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId)
  if (only) query = query.eq("id", only)
  const { data, error } = await query
  if (error || !data) return result
  const body = JSON.stringify(payload)
  const gone: string[] = []
  await Promise.all(
    (data as SubscriptionRow[]).map(async (row) => {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body, { TTL: 60 * 60 })
        result.sent += 1
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) gone.push(row.id)
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
