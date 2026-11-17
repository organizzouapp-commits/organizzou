import { timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"

import { dispatch } from "@/features/notifications/dispatch"
import { createSecretClient, secretKeyConfigured } from "@/lib/admin/secret"
import { sendToUser, vapidConfigProblem } from "@/lib/push/send"

// The scheduled dispatcher (an external cron calls it every 5 minutes; Vercel Cron keeps a daily run as a safety net). The work lives in
// src/features/notifications/dispatch.ts: it works out which notifications are due for each person who has a device subscribed and sends them,
// claiming each one in notification_log first so a re-run, an overlap or a retry never sends the same one twice. It reads other people's rows with the
// secret key, only to notify them, filtered by user_id; the call itself needs CRON_SECRET.
//
// GET ?dryRun=1 (same Bearer secret) sends NOTHING and returns what would be sent per kind, and why each candidate was skipped
// (pref_off, quiet_hours, outside_window, already_sent, no_subscription), by kind and id only.

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const wanted = Buffer.from(`Bearer ${secret}`)
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"
  const problem = vapidConfigProblem()
  if (!secretKeyConfigured()) return NextResponse.json({ ok: false, skipped: "the secret key is not configured on this server", problem: "secret_key_missing" }, { status: 200 })
  if (problem && !dryRun) return NextResponse.json({ ok: false, skipped: "push is not configured on this server", problem }, { status: 200 })

  const report = await dispatch({ db: createSecretClient(), now: new Date(), dryRun, send: sendToUser })
  console.warn(`[push] cron dryRun=${dryRun} users=${report.users} due=${report.due} sent=${report.sent} failed=${report.failed} skipped=${report.skipped}`)
  return NextResponse.json(dryRun && problem ? { ...report, pushProblem: problem } : report)
}
