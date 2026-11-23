import { billingContext, json } from "@/lib/billing/route"
import { getStatus } from "@/lib/billing/service"

/** Plan, subscription and payment state for the plan screen. The checkout polls this while a Pix is open. */
export async function GET(request: Request) {
  const c = await billingContext(request, { name: "status", limit: { max: 60, windowMs: 60_000 }, needsAsaas: false })
  if (!c.ok) return c.response
  try {
    const status = await getStatus(c.ctx.deps, c.ctx.user.id)
    return json({ ...status, plan: c.ctx.isAdmin ? "pro" : status.plan })
  } catch {
    return json({ error: "Não consegui ler a cobrança agora." }, 500)
  }
}
