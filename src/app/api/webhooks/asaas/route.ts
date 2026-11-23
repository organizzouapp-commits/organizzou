import { createSecretClient, secretKeyConfigured } from "@/lib/admin/secret"
import { supabaseBillingStore } from "@/lib/billing/store"
import { handleWebhook, tokenMatches, type WebhookPayload } from "@/lib/billing/webhook"

const MAX_BODY = 256 * 1024

/**
 * Asaas calls this when a payment or a subscription changes. No session: it is authenticated by the `asaas-access-token` header, compared
 * in constant time with ASAAS_WEBHOOK_TOKEN. Without that variable nothing is accepted. Answers are short and say nothing about the inside:
 * 200 once the event is recorded (a duplicate too), 401 for a wrong token, 500 so Asaas retries when processing failed.
 */
export async function POST(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim()
  if (!expected || !secretKeyConfigured()) return new Response(null, { status: 503 })
  if (!tokenMatches(request.headers.get("asaas-access-token"), expected)) return new Response(null, { status: 401 })

  const text = await request.text().catch(() => "")
  if (!text || text.length > MAX_BODY) return Response.json({ ok: true })
  let payload: WebhookPayload
  try {
    payload = JSON.parse(text) as WebhookPayload
  } catch {
    return Response.json({ ok: true })
  }

  try {
    await handleWebhook(supabaseBillingStore(createSecretClient()), payload)
    return Response.json({ ok: true })
  } catch {
    // Nothing from the event or the database is logged or returned: Asaas retries, and the event stays "not processed" until it works.
    console.error(JSON.stringify({ event: "asaas_webhook_error", type: typeof payload?.event === "string" ? payload.event : "unknown" }))
    return new Response(null, { status: 500 })
  }
}
