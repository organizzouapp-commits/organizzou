// Behavioral RLS check against the real project, using the public (publishable) key only.
// It signs up two throwaway users, creates rows as user A and verifies that user B and
// anonymous requests can neither read, change nor delete them.
//
//   RLS_CHECK_EMAIL=you@gmail.com node --env-file=.env.local supabase/tests/rls-check.mjs
//
// RLS_CHECK_EMAIL must be a real mailbox you own: the script signs up with plus-addresses
// (you+rls-a-123@gmail.com) because the project rejects fake domains such as example.com.
//
// The throwaway users stay in Auth (deleting users needs the service role key):
// remove them in Dashboard > Authentication > Users (emails contain "+rls-").
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e a chave publishable no .env.local")

const base = process.env.RLS_CHECK_EMAIL
if (!base || !base.includes("@")) throw new Error("Defina RLS_CHECK_EMAIL com um e-mail seu")
const [localPart, domain] = base.split("@")
const stamp = Date.now()
const password = `Rls-${stamp}-${Math.random().toString(36).slice(2)}`
const failures = []
let checks = 0

function check(name, ok, detail = "") {
  checks += 1
  if (!ok) failures.push(`${name} ${detail}`.trim())
}

async function signUp(label) {
  const client = createClient(url, key, { auth: { persistSession: false } })
  const email = `${localPart}+rls-${label}-${stamp}@${domain}`
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw new Error(`signUp ${label}: ${error.message}`)
  if (!data.session) throw new Error(`signUp ${label}: sem sessão (desligue "Confirm email" para este teste)`)
  return { client, id: data.user.id }
}

const a = await signUp("a")
const b = await signUp("b")
const anon = createClient(url, key, { auth: { persistSession: false } })

// ---- user A creates data in every table
const board = (await a.client.from("boards").insert({ user_id: a.id, name: "RLS A" }).select().single()).data
const list = (await a.client.from("board_lists").insert({ user_id: a.id, board_id: board.id, name: "L" }).select().single()).data
const task = (await a.client.from("tasks").insert({ user_id: a.id, board_id: board.id, list_id: list.id, title: "T" }).select().single()).data
const tag = (await a.client.from("tags").insert({ user_id: a.id, name: `tag-${stamp}` }).select().single()).data
const item = (await a.client.from("task_checklist_items").insert({ user_id: a.id, task_id: task.id, text: "i" }).select().single()).data
const comment = (await a.client.from("task_comments").insert({ user_id: a.id, task_id: task.id, body: "c" }).select().single()).data
const taskTag = (await a.client.from("task_tags").insert({ user_id: a.id, task_id: task.id, tag_id: tag.id }).select().single()).data
const attachment = (
  await a.client
    .from("attachments")
    .insert({ user_id: a.id, entity_type: "task", entity_id: task.id, storage_path: `${a.id}/x`, file_name: "x" })
    .select()
    .single()
).data
const audit = (await a.client.from("audit_log").insert({ user_id: a.id, actor: "app", action: "rls.check" }).select().single()).data

const rows = { boards: board, board_lists: list, tasks: task, tags: tag, task_checklist_items: item, task_comments: comment, task_tags: taskTag, attachments: attachment, audit_log: audit }
for (const [table, row] of Object.entries(rows)) check(`A can create a row in ${table}`, Boolean(row?.id))

const own = await a.client.from("profiles").select("id").eq("id", a.id)
check("A reads its own profile (created by trigger)", own.data?.length === 1)
const starter = await a.client.from("boards").select("id").eq("name", "Meu quadro")
check("sign-up trigger created the starter board", (starter.data?.length ?? 0) >= 1)

// ---- user B and anonymous cannot see, change or delete A's rows
for (const [table, row] of Object.entries(rows)) {
  const seenB = await b.client.from(table).select("id").eq("id", row.id)
  check(`B cannot read ${table}`, (seenB.data?.length ?? 0) === 0, JSON.stringify(seenB.error ?? ""))

  const seenAnon = await anon.from(table).select("id").eq("id", row.id)
  check(`anon cannot read ${table}`, (seenAnon.data?.length ?? 0) === 0)

  const del = await b.client.from(table).delete().eq("id", row.id).select("id")
  check(`B cannot delete from ${table}`, (del.data?.length ?? 0) === 0)
}
const seenProfile = await b.client.from("profiles").select("id").eq("id", a.id)
check("B cannot read A's profile", (seenProfile.data?.length ?? 0) === 0)
const patchProfile = await b.client.from("profiles").update({ display_name: "hacked" }).eq("id", a.id).select("id")
check("B cannot update A's profile", (patchProfile.data?.length ?? 0) === 0)
const patchTask = await b.client.from("tasks").update({ title: "hacked" }).eq("id", task.id).select("id")
check("B cannot update A's task", (patchTask.data?.length ?? 0) === 0)

// ---- B cannot write into A's data or spoof ownership
const spoof = await b.client.from("tags").insert({ user_id: a.id, name: `spoof-${stamp}` })
check("B cannot insert a row owned by A", Boolean(spoof.error))
const intoBoard = await b.client.from("tasks").insert({ user_id: b.id, board_id: board.id, list_id: list.id, title: "intruder" })
check("B cannot attach a task to A's board", Boolean(intoBoard.error))
const intoTask = await b.client.from("task_comments").insert({ user_id: b.id, task_id: task.id, body: "intruder" })
check("B cannot comment on A's task", Boolean(intoTask.error))

// ---- audit_log is append-only
const editAudit = await a.client.from("audit_log").update({ action: "tampered" }).eq("id", audit.id).select("id")
check("audit_log cannot be updated by its owner", (editAudit.data?.length ?? 0) === 0)
const dropAudit = await a.client.from("audit_log").delete().eq("id", audit.id).select("id")
check("audit_log cannot be deleted by its owner", (dropAudit.data?.length ?? 0) === 0)

// ---- cleanup of A's data (rows cascade from the board)
await a.client.from("boards").delete().eq("id", board.id)
await a.client.from("tags").delete().eq("id", tag.id)
await a.client.from("attachments").delete().eq("id", attachment.id)

console.log(`${checks - failures.length}/${checks} checks passed`)
if (failures.length) {
  console.log(failures.map((f) => `  FAIL: ${f}`).join("\n"))
  process.exit(1)
}
