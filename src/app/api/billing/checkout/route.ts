import { z } from "zod"

import { billingContext, json, withAsaas } from "@/lib/billing/route"
import { startCheckout } from "@/lib/billing/service"

const body = z.object({ period: z.enum(["monthly", "annual"]), method: z.enum(["card", "pix", "boleto"]), cpfCnpj: z.string().min(11).max(18) })

/** Starts a checkout: Pix answers with the QR code, card and boleto with the address of the Asaas-hosted page. The CPF/CNPJ is never logged. */
export async function POST(request: Request) {
  const c = await billingContext(request, { name: "checkout", limit: { max: 6, windowMs: 60_000 }, needsAsaas: true })
  if (!c.ok) return c.response
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Confira os dados do pagamento e tente de novo." }, 400)
  const result = await startCheckout(withAsaas(c.ctx), c.ctx.user, parsed.data)
  return result.ok ? json(result) : json({ error: result.error }, result.status)
}
