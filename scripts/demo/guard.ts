/**
 * The safety rules of the demo seed, kept pure so tests can prove them.
 *  - Only e-mails in the allowlist can be seeded. The default is the test account alone; `DEMO_SEED_ALLOWLIST` (comma-separated,
 *    in .env.local or the shell) can widen it for a second test account.
 *  - patrick.toledo.barros@gmail.com is refused ALWAYS, even if someone puts it in the allowlist.
 *  - In production (NODE_ENV, VERCEL_ENV or APP_ENV = production) it needs the explicit --i-know-this-is-production flag.
 */
export const DEFAULT_ALLOWLIST = ["organizzouapp@gmail.com"]
export const ALWAYS_BLOCKED = ["patrick.toledo.barros@gmail.com"]
export const PRODUCTION_FLAG = "--i-know-this-is-production"

export function allowlistFrom(env: Record<string, string | undefined>) {
  const raw = env.DEMO_SEED_ALLOWLIST?.trim()
  const list = raw ? raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) : DEFAULT_ALLOWLIST
  return list.filter((e) => !ALWAYS_BLOCKED.includes(e))
}

export const isProduction = (env: Record<string, string | undefined>) => env.NODE_ENV === "production" || env.VERCEL_ENV === "production" || env.APP_ENV === "production"

export type SeedRequest = { email: string | undefined; env: Record<string, string | undefined>; flags: string[] }
export type SeedDecision = { ok: true; email: string } | { ok: false; message: string }

export function checkSeedRequest({ email, env, flags }: SeedRequest): SeedDecision {
  const target = email?.trim().toLowerCase()
  if (!target) return { ok: false, message: "Uso: npm run seed:demo -- <e-mail da conta de teste>" }
  if (ALWAYS_BLOCKED.includes(target)) return { ok: false, message: `Recusado: ${target} é a conta pessoal e precisa ficar limpa, sem dados de demonstração.` }
  if (!allowlistFrom(env).includes(target)) return { ok: false, message: `Recusado: ${target} não está na lista de contas de teste (${allowlistFrom(env).join(", ")}).` }
  if (isProduction(env) && !flags.includes(PRODUCTION_FLAG)) return { ok: false, message: `Recusado: ambiente de produção. Se você tem certeza, repita com ${PRODUCTION_FLAG}.` }
  return { ok: true, email: target }
}
