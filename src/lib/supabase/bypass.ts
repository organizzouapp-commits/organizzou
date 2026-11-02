/**
 * The local development switch that skips the login (`PROTOTYPE_BYPASS_AUTH=1`) and everything that hangs off it: the dev_admin,
 * dev_plan and dev_whatsapp cookies. It must be impossible to turn on in production, even if the variable is set by mistake, so it
 * is OFF whenever either signal says "production":
 *  - NODE_ENV === "production" (every `next build` / `next start`, which is also what Vercel runs, preview deploys included);
 *  - VERCEL_ENV === "production" (the Vercel production environment, whatever NODE_ENV is).
 * Pure on purpose, so a test can prove it. Every use of those cookies goes through `bypassAuth` (a test checks that too).
 */
export function devBypassEnabled(env: Record<string, string | undefined>) {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") return false
  return env.PROTOTYPE_BYPASS_AUTH === "1"
}

export const bypassAuth = devBypassEnabled(process.env)
