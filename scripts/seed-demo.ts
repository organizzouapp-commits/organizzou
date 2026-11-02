/**
 * Demo data as REAL rows, in ONE test account (organizzouapp@gmail.com by default), so every screen can be seen full.
 *
 *   npm run seed:demo -- organizzouapp@gmail.com          loads (or refreshes) the demo
 *   npm run seed:demo:reset -- organizzouapp@gmail.com    removes only the rows the demo created
 *
 * Loading again never duplicates anything: a second run removes every row the demo created before (they are the version-5 uuids)
 * and writes them again with dates relative to today (America/Sao_Paulo). Rows the person created themselves are not touched
 * (rows that hang off a demo row, like a task someone added to a demo board, go with it).
 * Safety rules: scripts/demo/guard.ts (allowlist, Patrick always refused, production needs a flag).
 * Needs SUPABASE_SECRET_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local (loaded by `node --env-file`). The key is never printed.
 */
import { createClient } from "@supabase/supabase-js"

import { buildDemo, categoryLimits, DEMO_CATEGORY_LIMITS, DEMO_FILE_BODIES, DEMO_TABLES, type Refs } from "./demo/content.ts"
import { checkSeedRequest } from "./demo/guard.ts"

const args = process.argv.slice(2)
const reset = args.includes("--reset")
const flags = args.filter((a) => a.startsWith("--"))
const decision = checkSeedRequest({ email: args.find((a) => !a.startsWith("--")), env: process.env, flags })
if (!decision.ok) {
  console.error(decision.message)
  process.exit(1)
}
const email = decision.email

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !secretKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.")
  process.exit(1)
}
const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function findUser(target: string) {
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 1000) return null
  }
  return null
}

const user = await findUser(email)
if (!user) {
  console.error(`A conta ${email} ainda não existe. Entre uma vez no app com o Google usando esse e-mail (isso cria a conta) e rode o comando de novo.`)
  process.exit(1)
}
const uid = user.id

// The defaults first (board, categories, account, goals): idempotent, and the demo hangs off them.
{
  const { error } = await db.rpc("provision_user", { p_user: uid })
  if (error) {
    console.error(`Não consegui preparar a conta: ${error.message}\nAs migrations de dados já foram aplicadas? (npx supabase db push)`)
    process.exit(1)
  }
}

const rows = async (table: string, columns: string) => {
  const { data, error } = await db.from(table).select(columns).or(`user_id.eq.${uid},user_id.is.null`)
  if (error) throw new Error(`${table}: ${error.message}`)
  return (data ?? []) as unknown as Record<string, string>[]
}
const byName = (list: Record<string, string>[]) => Object.fromEntries(list.map((r) => [r.name, r.id]))
const refs: Refs = {
  userId: uid,
  categories: byName(await rows("finance_categories", "id, name")),
  foods: byName(await rows("foods", "id, name")),
  exercises: byName(await rows("exercises", "id, name")),
}

const demo = buildDemo(new Date(), refs)

/**
 * Every demo id is a version-5 uuid (see demoId in scripts/demo/content.ts) and nothing else in the app creates one: real rows are
 * random version-4 uuids. So "the rows the demo created" is exactly "the version-5 ids of this account", including rows an earlier run
 * wrote for other dates (the content changes with the calendar, so the set of ids can differ from one day to the next).
 */
/** PostgREST says PGRST205 (or Postgres 42P01) for a table that does not exist: its migration is still waiting. */
const isMissingTable = (error: { code?: string }) => error.code === "PGRST205" || error.code === "42P01"
const skipped: string[] = []

const isDemoId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)

async function demoIdsIn(table: string) {
  const found: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("id").eq("user_id", uid).range(from, from + 999)
    if (error && isMissingTable(error)) return found // a migration that has not been applied yet: nothing of the demo can be there
    if (error) throw new Error(`ler ${table}: ${error.message}`)
    found.push(...(data ?? []).map((r) => r.id as string).filter(isDemoId))
    if ((data ?? []).length < 1000) return found
  }
}

/** Removes every row the demo created in this account, children first. */
async function removeDemo() {
  let removed = 0
  for (const table of [...DEMO_TABLES].reverse()) {
    const ids = await demoIdsIn(table)
    if (table === "attachments" && ids.length > 0) {
      // The files go too: remove them from Storage before their rows disappear.
      const { data } = await db.from("attachments").select("storage_path").eq("user_id", uid).in("id", ids)
      const paths = (data ?? []).map((r) => r.storage_path as string)
      if (paths.length > 0) await db.storage.from("task-attachments").remove(paths)
    }
    for (let i = 0; i < ids.length; i += 150) {
      const { error, count } = await db.from(table).delete({ count: "exact" }).eq("user_id", uid).in("id", ids.slice(i, i + 150))
      if (error) throw new Error(`apagar ${table}: ${error.message}`)
      removed += count ?? 0
    }
  }
  // The limits the demo put on the default categories go back to "no limit".
  for (const name of Object.keys(DEMO_CATEGORY_LIMITS)) {
    await db.from("finance_categories").update({ monthly_limit_cents: null }).eq("user_id", uid).eq("name", name)
  }
  return removed
}

if (reset) {
  console.log(`Demonstração removida de ${email}: ${await removeDemo()} linhas.`)
  process.exit(0)
}

// A run on another day changes the relative dates: the earlier demo rows are replaced instead of stacking on top.
const replaced = await removeDemo()

for (const { table, rows: list } of demo) {
  if (table === "attachments") {
    for (const row of list) {
      const body = DEMO_FILE_BODIES[row.file_name as string] ?? "Arquivo de demonstração"
      const { error } = await db.storage.from("task-attachments").upload(row.storage_path as string, new Blob([body], { type: row.mime_type as string }), { contentType: row.mime_type as string, upsert: true })
      if (error) {
        console.error(`Falhou ao enviar o anexo ${row.file_name}: ${error.message}`)
        process.exit(1)
      }
    }
  }
  for (let i = 0; i < list.length; i += 200) {
    const { error } = await db.from(table).insert(list.slice(i, i + 200).map((r) => ({ ...r, user_id: uid })))
    if (error && isMissingTable(error)) {
      // Everything else is loaded; this part waits for its migration (npx supabase db push) and the next run fills it in.
      skipped.push(table)
      console.warn(`Pulado: a tabela ${table} ainda não existe (migration pendente).`)
      break
    }
    if (error) {
      console.error(`Falhou em ${table}: ${error.message}`)
      process.exit(1)
    }
  }
}
for (const [name, limit] of Object.entries(categoryLimits(demo, refs, new Date()))) await db.from("finance_categories").update({ monthly_limit_cents: limit }).eq("user_id", uid).eq("name", name)

// Mark it as a test account, so the admin numbers leave it out by default.
const marked = await db.from("profiles").update({ is_test: true }).eq("id", uid)
if (marked.error) console.warn(`Aviso: não consegui marcar a conta como de teste (${marked.error.message}). A migration 20261103000004 já foi aplicada?`)

const total = demo.filter((t) => !skipped.includes(t.table)).reduce((sum, t) => sum + t.rows.length, 0)
console.log(`Demonstração carregada em ${email}: ${total} linhas em ${DEMO_TABLES.length} tabelas${replaced > 0 ? ` (substituiu ${replaced} da carga anterior)` : ""}. Recarregue o app.`)
