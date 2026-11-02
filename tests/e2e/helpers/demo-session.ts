/**
 * A real signed-in session for the demo account, without a password and without touching the account: the Auth admin API makes a
 * one-time magic-link token (nothing is e-mailed), it is exchanged for a session exactly like the app's own sign-in, and the cookies
 * the app would have set are returned for Playwright. Needs SUPABASE_SECRET_KEY in .env.local; the key is never printed.
 * Only for the allowlisted demo account (the same rule as the seed).
 */
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

import { checkSeedRequest } from "../../../scripts/demo/guard.ts"

type Cookie = { name: string; value: string; url: string }

export function loadEnv() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    try {
      process.loadEnvFile(".env.local")
    } catch {
      // The variables may already be in the shell.
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !secret || !anon) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL, a chave pública e SUPABASE_SECRET_KEY no .env.local.")
  return { url, secret, anon }
}

const cache = new Map<string, Promise<Cookie[]>>()

/** Cookies of a signed-in session for `email` (must be on the demo allowlist). One session is made per run and shared by every test (Auth rate-limits new ones). */
export function demoSessionCookies(email: string, baseURL: string): Promise<Cookie[]> {
  const key = `${email}|${baseURL}`
  if (!cache.has(key)) cache.set(key, newDemoSession(email, baseURL))
  return cache.get(key)!
}

async function newDemoSession(email: string, baseURL: string): Promise<Cookie[]> {
  const decision = checkSeedRequest({ email, env: process.env, flags: ["--i-know-this-is-production"] })
  if (!decision.ok) throw new Error(decision.message)
  const { url, secret, anon } = loadEnv()

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: decision.email })
  const hashed = link.data?.properties?.hashed_token
  if (link.error || !hashed) throw new Error("Não consegui gerar o acesso da conta de demonstração.")

  const captured = new Map<string, string>()
  const ssr = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...captured].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? captured.set(name, value) : captured.delete(name))),
    },
  })
  const { error } = await ssr.auth.verifyOtp({ token_hash: hashed, type: "magiclink" })
  if (error) throw new Error(`Não consegui abrir a sessão: ${error.message}`)
  // The cookie writes are queued by the auth client: give them a moment.
  await new Promise((resolve) => setTimeout(resolve, 300))
  return [...captured].map(([name, value]) => ({ name, value, url: baseURL }))
}

/** Ids of the demo boards by name, so a screenshot can open a specific board. */
export async function boardIds(email: string): Promise<Record<string, string>> {
  const { url, secret } = loadEnv()
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  let uid: string | undefined
  for (let page = 1; page <= 20 && !uid; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    uid = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id
    if ((data?.users.length ?? 0) < 1000) break
  }
  if (!uid) return {}
  const { data } = await admin.from("boards").select("id, name").eq("user_id", uid)
  return Object.fromEntries((data ?? []).map((b) => [b.name as string, b.id as string]))
}
