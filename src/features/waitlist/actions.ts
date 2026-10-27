"use server"

import { createHmac } from "node:crypto"
import { headers } from "next/headers"

import { toE164 } from "@/features/auth/schemas"
import { createAdminClient } from "@/lib/supabase/admin"

import { waitlistSchema, type WaitlistInput, type WaitlistResult } from "./schemas"

const MAX_ATTEMPTS_PER_HOUR = 3
const GENERIC_ERROR = "Não consegui salvar agora. Tente de novo em instantes."

function hash(value: string) {
  // Keyed with the service role key so hashes can't be reversed or rainbow-tabled without it.
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update(value).digest("hex")
}

export async function joinWaitlist(input: WaitlistInput): Promise<WaitlistResult> {
  const parsed = waitlistSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0])
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message
    }
    return { ok: false, error: "Confira os campos e tente de novo.", fieldErrors }
  }

  // Bots fill the hidden field: answer as if it worked and store nothing.
  if (parsed.data.website) return { ok: true }

  const phone = toE164(parsed.data.phone)
  if (!phone) return { ok: false, error: "Informe um WhatsApp válido com DDD.", fieldErrors: { phone: "Informe um WhatsApp válido com DDD." } }
  const email = parsed.data.email.toLowerCase()

  const requestHeaders = await headers()
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown"
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 300) ?? null
  const ipHash = hash(`ip:${ip}`)
  const emailHash = hash(`email:${email}`)

  try {
    const admin = createAdminClient()

    // Rate limit: at most 3 attempts per hour for the same IP and for the same e-mail.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const [byIp, byEmail] = await Promise.all([
      admin.from("waitlist_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since),
      admin.from("waitlist_attempts").select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gte("created_at", since),
    ])
    if ((byIp.count ?? 0) >= MAX_ATTEMPTS_PER_HOUR || (byEmail.count ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
      return { ok: false, error: "Muitas tentativas por aqui. Tente de novo daqui a pouco." }
    }
    await admin.from("waitlist_attempts").insert({ ip_hash: ipHash, email_hash: emailHash })

    const { error } = await admin.from("waitlist").insert({
      name: parsed.data.name,
      phone,
      email,
      consent_at: new Date().toISOString(),
      source: "em-breve",
      user_agent: userAgent,
    })
    if (error) {
      if (error.code === "23505") return { ok: true, already: true }
      return { ok: false, error: GENERIC_ERROR }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}
