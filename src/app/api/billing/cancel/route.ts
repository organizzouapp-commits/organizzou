import { z } from "zod"

import { billingContext, json, withAsaas } from "@/lib/billing/route"
import { cancelSubscription } from "@/lib/billing/service"

const body = z.object({ reason: z.string().max(60).optional() }).optional()

/** Cancels at the end of the paid period: Pro stays until plan_until. Nothing is deleted. */
export async function POST(request: Request) {
  const c = await billingContext(request, { name: "cancel", limit: { max: 5, windowMs: 60_000 }, needsAsaas: true })
  if (!c.ok) return c.response
  // The reason chip is optional and is not stored by billing: only validated, so a bad body is refused.
  if (!body.safeParse(await request.json().catch(() => undefined)).success) return json({ error: "Pedido inválido." }, 400)
  const result = await cancelSubscription(withAsaas(c.ctx), c.ctx.user.id)
  return result.ok ? json(result) : json({ error: result.error }, result.status)
}
