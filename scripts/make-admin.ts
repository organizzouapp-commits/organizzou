/**
 * Grant or revoke the Organizzou admin role (app_metadata.role = "admin").
 *
 *   npm run admin:grant     asks for an e-mail and makes that account an admin
 *   npm run admin:revoke    asks for an e-mail and removes the role
 *
 * Needs SUPABASE_SECRET_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local (loaded by `node --env-file`). The key is never printed.
 * The person must sign out and in again (or wait for the token to refresh) before the new role shows up.
 */
import { createInterface } from "node:readline/promises"

import { createClient } from "@supabase/supabase-js"

const mode = process.argv[2]
if (mode !== "grant" && mode !== "revoke") {
  console.error('Uso: node scripts/make-admin.ts grant|revoke  (ou "npm run admin:grant" / "npm run admin:revoke")')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !secretKey) {
  console.error("Faltam variáveis em .env.local. Abra o arquivo .env.local e preencha (sem aspas):")
  if (!url) console.error("  NEXT_PUBLIC_SUPABASE_URL=")
  if (!secretKey) console.error("  SUPABASE_SECRET_KEY=   (Supabase > Project Settings > API Keys > Secret key)")
  process.exit(1)
}

const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

const rl = createInterface({ input: process.stdin, output: process.stdout })
const email = (await rl.question(`E-mail da conta para ${mode === "grant" ? "tornar admin" : "remover do admin"}: `)).trim().toLowerCase()
rl.close()
if (!email) {
  console.error("Nenhum e-mail informado.")
  process.exit(1)
}

// The Auth API has no lookup by e-mail: page through the users.
async function findUser(target: string) {
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const hit = data.users.find((user) => user.email?.toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 1000) return null
  }
  return null
}

const user = await findUser(email)
if (!user) {
  console.error(`Nenhuma conta com o e-mail ${email}.`)
  process.exit(1)
}

const isAdmin = user.app_metadata?.role === "admin"
if (mode === "grant" && isAdmin) {
  console.log(`${email} já é admin.`)
  process.exit(0)
}
if (mode === "revoke" && !isAdmin) {
  console.log(`${email} não é admin.`)
  process.exit(0)
}

// app_metadata is merged by the Auth API; null removes the key.
const { error } = await supabase.auth.admin.updateUserById(user.id, { app_metadata: { role: mode === "grant" ? "admin" : null } })
if (error) {
  console.error(`Não foi possível atualizar a conta: ${error.message}`)
  process.exit(1)
}

// Best effort: the audit table only exists after the admin migration was applied.
const { error: auditError } = await supabase.from("admin_audit_log").insert({
  admin_id: null,
  admin_email: "cli",
  action: mode === "grant" ? "admin.grant" : "admin.revoke",
  target_user_id: user.id,
  target_email: user.email,
  payload: { via: "scripts/make-admin.ts" },
})
if (auditError) console.warn("Aviso: não foi possível gravar na auditoria (a migration do admin já foi aplicada?).")

console.log(mode === "grant" ? `${email} agora é admin. Peça para sair e entrar de novo.` : `${email} não é mais admin. A sessão atual perde o acesso quando o token renovar.`)
