import { z } from "zod"

import { billingContext, json, withAsaas } from "@/lib/billing/route"
import { changePlan } from "@/lib/billing/service"

const body = z.object({ period: z.enum(["monthly", "annual"]) })

/** Monthly <-> annual, from the next charge on. */
export async function POST(request: Request) {
  const c = await billingContext(request, { name: "change-plan", limit: { max: 5, windowMs: 60_000 }, needsAsaas: true })
  if (!c.ok) return c.response
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Escolha mensal ou anual." }, 400)
  const result = await changePlan(withAsaas(c.ctx), c.ctx.user.id, parsed.data.period)
  return result.ok ? json(result) : json({ error: result.error }, result.status)
}
