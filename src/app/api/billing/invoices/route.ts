import { billingContext, json } from "@/lib/billing/route"
import { listInvoices } from "@/lib/billing/service"

/** The person's own invoices (latest first). */
export async function GET(request: Request) {
  const c = await billingContext(request, { name: "invoices", limit: { max: 30, windowMs: 60_000 }, needsAsaas: false })
  if (!c.ok) return c.response
  try {
    return json({ invoices: await listInvoices(c.ctx.deps, c.ctx.user.id) })
  } catch {
    return json({ error: "Não consegui ler as faturas agora." }, 500)
  }
}
