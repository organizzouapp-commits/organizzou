import { billingContext, json } from "@/lib/billing/route"
import { getStatus } from "@/lib/billing/service"
import { syncPayment } from "@/lib/billing/webhook"

/** Plan, subscription and payment state for the plan screen. The checkout polls this while a Pix is open. */
export async function GET(request: Request) {
  const c = await billingContext(request, { name: "status", limit: { max: 60, windowMs: 60_000 }, needsAsaas: false })
  if (!c.ok) return c.response
  try {
    // While a Pix is open the screen passes its payment id: if the webhook is late, Asaas is asked about this person's own payment.
    const paymentId = new URL(request.url).searchParams.get("payment")
    let paid: boolean | undefined
    if (paymentId && c.ctx.asaas && /^[A-Za-z0-9_-]{4,64}$/.test(paymentId)) paid = await syncPayment({ asaas: c.ctx.asaas, store: c.ctx.store, now: c.ctx.deps.now }, c.ctx.user.id, paymentId)
    const status = await getStatus(c.ctx.deps, c.ctx.user.id)
    return json({ ...status, plan: c.ctx.isAdmin ? "pro" : status.plan, ...(paid === undefined ? {} : { paymentPaid: paid }) })
  } catch {
    return json({ error: "Não consegui ler a cobrança agora." }, 500)
  }
}
