/**
 * Gives every EXISTING account what a new account gets at sign-up (profile, "Minhas tarefas" board, finance categories and a
 * "Conta principal", diet goals, notification preferences, default Hoje layout).
 *
 *   npm run users:backfill              provisions every account
 *   npm run users:backfill -- --dry-run only says how many accounts would be touched
 *
 * Safe to run any number of times: it calls the same idempotent database function as the sign-up trigger
 * (public.provision_user), which only fills what is missing and never updates or deletes an existing row.
 * Needs SUPABASE_SECRET_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local (loaded by `node --env-file`). The key is never printed.
 */
import { createClient } from "@supabase/supabase-js"

const dryRun = process.argv.includes("--dry-run")
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !secretKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.")
  process.exit(1)
}
const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

const users: { id: string; email: string }[] = []
for (let page = 1; page <= 100; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw error
  users.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? "(sem e-mail)" })))
  if (data.users.length < 1000) break
}

const count = async (table: string) => (await supabase.from(table).select("*", { count: "exact", head: true })).count ?? 0
const before = { profiles: await count("profiles"), boards: await count("boards"), categories: await count("finance_categories"), accounts: await count("finance_accounts") }
console.log(`${users.length} conta(s) no Auth. Antes: ${before.profiles} perfis, ${before.boards} quadros, ${before.categories} categorias, ${before.accounts} contas financeiras.`)

if (dryRun) {
  console.log("--dry-run: nada foi alterado.")
  process.exit(0)
}

let failed = 0
for (const user of users) {
  const { error } = await supabase.rpc("provision_user", { p_user: user.id })
  if (error) {
    failed += 1
    console.error(`  falhou para ${user.email}: ${error.message}`)
  } else {
    console.log(`  ok: ${user.email}`)
  }
}
const after = { profiles: await count("profiles"), boards: await count("boards"), categories: await count("finance_categories"), accounts: await count("finance_accounts") }
console.log(`Depois: ${after.profiles} perfis, ${after.boards} quadros, ${after.categories} categorias, ${after.accounts} contas financeiras.`)
if (failed > 0) {
  console.error(`${failed} conta(s) falharam. A migration 20261103000003_provisioning.sql já foi aplicada?`)
  process.exit(1)
}
