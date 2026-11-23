import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { isAdminClaims } from "@/lib/admin/claims"
import { createSecretClient, secretKeyConfigured } from "@/lib/admin/secret"
import { createLimiter, type Limit } from "@/lib/rate-limit"
import { settingsHref } from "@/lib/settings-tabs"
import { getSiteUrl } from "@/lib/site-url"
import { dayOf } from "@/lib/sp-time"
import { bypassAuth } from "@/lib/supabase/proxy"
import { createClient } from "@/lib/supabase/server"

import { type AsaasClient, asaasFromEnv } from "./asaas"
import type { BillingUser, Deps } from "./service"
import { type BillingStore, supabaseBillingStore } from "./store"

/** Shared by the /api/billing routes: JSON answers, same-origin check, session, rate limit and the dependencies of the service. */

export const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } })

const limiters = new Map<string, ReturnType<typeof createLimiter>>()
const limiterFor = (name: string, limit: Limit) => {
  let l = limiters.get(name)
  if (!l) limiters.set(name, (l = createLimiter(limit)))
  return l
}

/** A browser sends Origin on a POST: when it is there it must be our own address (the session cookie alone is not enough). */
export function sameOrigin(request: Request, siteUrl = getSiteUrl()): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(siteUrl).host || new URL(origin).host === request.headers.get("host")
  } catch {
    return false
  }
}

export type RouteContext = { user: BillingUser; isAdmin: boolean; store: BillingStore; asaas: AsaasClient | null; deps: Omit<Deps, "asaas"> }

/**
 * Authenticated, rate limited, same-origin context for a billing route. `needsAsaas`: the route talks to Asaas, so a missing ASAAS_API_KEY is
 * a clear "not configured" answer instead of a crash. The secret key is used only after the person is authenticated, and only on the server.
 */
export async function billingContext(request: Request, { name, limit, needsAsaas }: { name: string; limit: Limit; needsAsaas: boolean }): Promise<{ ok: true; ctx: RouteContext } | { ok: false; response: Response }> {
  if (request.method !== "GET" && !sameOrigin(request)) return { ok: false, response: json({ error: "forbidden" }, 403) }
  if (bypassAuth) return { ok: false, response: json({ error: "unauthorized" }, 401) }
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const userId = claims?.sub
  if (!userId) return { ok: false, response: json({ error: "unauthorized" }, 401) }

  const hit = limiterFor(name, limit).hit(userId)
  if (!hit.ok) return { ok: false, response: Response.json({ error: "Muitas tentativas. Espere um instante e tente de novo." }, { status: 429, headers: { "Retry-After": String(Math.ceil(hit.retryAfterMs / 1000)), "Cache-Control": "no-store" } }) }

  if (!secretKeyConfigured()) return { ok: false, response: json({ error: "O pagamento ainda não está configurado.", code: "not_configured" }, 503) }
  const asaas = asaasFromEnv()
  if (needsAsaas && !asaas) return { ok: false, response: json({ error: "O pagamento ainda não está configurado.", code: "not_configured" }, 503) }

  const profile = await (supabase as unknown as SupabaseClient).from("profiles").select("display_name").eq("id", userId).maybeSingle()
  const user: BillingUser = { id: userId, email: String(claims?.email ?? ""), name: (profile.data as { display_name?: string } | null)?.display_name ?? "" }
  const now = new Date()
  const store = supabaseBillingStore(createSecretClient())
  return {
    ok: true,
    ctx: { user, isAdmin: isAdminClaims(claims), store, asaas, deps: { store, now, today: dayOf(now, 0), siteUrl: getSiteUrl(), returnPath: `${settingsHref("plano")}&pagamento=retorno` } },
  }
}

export const withAsaas = (ctx: RouteContext): Deps => ({ ...ctx.deps, asaas: ctx.asaas! })
