import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Privacy (LGPD) and access rules for the admin area, enforced as tests instead of promises:
 *  - every function in the `admin` schema is SECURITY DEFINER, pins search_path and starts with the is_admin() check;
 *  - none of them reads the `vault` schema or any content column (titles, descriptions, bodies, payloads...);
 *  - the secret key never reaches a client bundle.
 * They read the migrations as text, so they run anywhere (no database needed). The behavior against a real database is covered by
 * supabase/tests/admin_forbidden.sql.
 */
const ROOT = join(__dirname, "..", "..", "..")
const MIGRATIONS = join(ROOT, "supabase", "migrations")

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name.startsWith(".")) return []
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

/** SQL without `-- comments`, so words in explanations do not count (and cannot hide anything: comments never run). */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, "")

const migrationFiles = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()
const migrations = migrationFiles.map((file) => ({ file, sql: readFileSync(join(MIGRATIONS, file), "utf8") }))
const adminMigrations = migrations.filter((m) => /admin|last_seen/.test(m.file))

type AdminFunction = { name: string; file: string; header: string; body: string }

function adminFunctions(): AdminFunction[] {
  const found: AdminFunction[] = []
  const pattern = /create\s+(?:or\s+replace\s+)?function\s+(admin\.\w+)\s*\([\s\S]*?\)\s*returns[\s\S]*?as\s+\$\$([\s\S]*?)\$\$\s*;/gi
  for (const { file, sql } of migrations) {
    for (const match of stripComments(sql).matchAll(pattern)) {
      const whole = match[0]
      found.push({ name: match[1], file, header: whole.slice(0, whole.search(/as\s+\$\$/i)), body: match[2] })
    }
  }
  return found
}

const functions = adminFunctions()

/** Words that mean "the content of a person's records". None may appear in an admin function. */
const CONTENT_WORDS = /\b(title|description|notes?|content|body|comments?|checklist|payload|message_text|storage_path|file_name|vault)\b/i

/** The only relations an admin function may read. Content tables are only ever counted (see the next test). */
const ALLOWED_RELATIONS = new Set([
  "auth.users",
  "auth.identities",
  "auth.sessions",
  "public.profiles",
  "public.waitlist",
  "public.user_activity_hourly",
  "public.audit_log",
  "public.boards",
  "public.tasks",
  "public.tags",
  "public.attachments",
  "admin.activity_days",
  // last_migration(): reads only the latest version string.
  "supabase_migrations.schema_migrations",
])

describe("admin SQL functions", () => {
  it("finds the functions (the parser is not silently matching nothing)", () => {
    const names = functions.map((f) => f.name)
    for (const expected of ["admin.overview_stats", "admin.list_users", "admin.user_detail", "admin.cohort_retention", "admin.revoke_user_sessions", "admin.waitlist_list", "admin.assistant_usage"]) {
      expect(names, expected).toContain(expected)
    }
    expect(functions.length).toBeGreaterThanOrEqual(18)
  })

  it.each(functions.map((f) => [f.name, f] as const))("%s is SECURITY DEFINER with a pinned search_path", (_name, fn) => {
    expect(fn.header, fn.name).toMatch(/security\s+definer/i)
    expect(fn.header, fn.name).toMatch(/set\s+search_path\s*=\s*''/i)
  })

  it.each(functions.map((f) => [f.name, f] as const))("%s starts with the is_admin() check and raises 'forbidden'", (_name, fn) => {
    const afterBegin = fn.body.slice(fn.body.search(/\bbegin\b/i) + "begin".length).trim()
    expect(afterBegin.startsWith("if not public.is_admin() then raise exception 'forbidden'; end if;"), `${fn.name} must start with the check, got: ${afterBegin.slice(0, 80)}`).toBe(true)
  })

  it.each(functions.map((f) => [f.name, f] as const))("%s never touches the vault or any content column", (_name, fn) => {
    expect(fn.body, fn.name).not.toMatch(CONTENT_WORDS)
    expect(fn.header, fn.name).not.toMatch(CONTENT_WORDS)
  })

  it.each(functions.map((f) => [f.name, f] as const))("%s reads only allowed relations, and content tables only through count()", (_name, fn) => {
    const relations = [...fn.body.matchAll(/(?<!\bextract\(\s*\w+\s)\b(?:from|join)\s+([a-z_]+\.[a-z_]+)\b(?!\s*\()/gi)].map((m) => m[1].toLowerCase())
    for (const relation of relations) expect(ALLOWED_RELATIONS.has(relation), `${fn.name} reads ${relation}`).toBe(true)

    // boards / tasks / tags / attachments hold content. They must be aliased, and through that alias only `user_id` and `created_at`
    // may be referenced: that is enough to count rows per person and per week, and nothing more.
    for (const table of ["boards", "tasks", "tags", "attachments"]) {
      for (const use of fn.body.matchAll(new RegExp(`\\b(?:from|join)\\s+public\\.${table}\\b(?:\\s+(\\w+))?`, "gi"))) {
        const alias = use[1]
        expect(alias && !/^(where|on|union|group|order|limit|join|left|inner)$/i.test(alias), `${fn.name}: alias public.${table} so its columns can be checked`).toBeTruthy()
        const columns = new Set([...fn.body.matchAll(new RegExp(`\\b${alias}\\.(\\w+)`, "g"))].map((m) => m[1]))
        for (const column of columns) expect(["user_id", "created_at"], `${fn.name} reads ${table}.${column}`).toContain(column)
      }
    }
  })

  it("revokes execute from anon/public and grants authenticated only (loop covers every admin function)", () => {
    const all = migrations.map((m) => stripComments(m.sql)).join("\n")
    expect(all).toMatch(/revoke all on function %s from public, anon/i)
    expect(all).toMatch(/grant execute on function %s to authenticated/i)
    expect(all).toMatch(/where n\.nspname = 'admin'/i)
    expect(all).not.toMatch(/grant\s+(?:execute|all)[^;]*admin[^;]*\bto\b[^;]*\banon\b/i)
  })

  it("the internal activity view is not readable by anyone but its owner", () => {
    const sql = stripComments(adminMigrations.map((m) => m.sql).join("\n"))
    expect(sql).toMatch(/revoke all on admin\.activity_days from public, anon, authenticated/i)
  })
})

describe("admin access model", () => {
  const access = stripComments(migrations.find((m) => m.file.includes("admin_access"))!.sql)

  it("is_admin() reads app_metadata.role from the JWT", () => {
    expect(access).toMatch(/auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'role'/i)
    expect(access).toMatch(/revoke execute on function public\.is_admin\(\) from public, anon/i)
  })

  it("admin_audit_log is admin-only for select and has no write policy for users", () => {
    expect(access).toMatch(/alter table public\.admin_audit_log enable row level security/i)
    expect(access).toMatch(/revoke all on public\.admin_audit_log from anon, authenticated/i)
    expect(access).toMatch(/create policy "admin_audit_log_select_admin"[\s\S]*?using \(public\.is_admin\(\)\)/i)
    expect(access).not.toMatch(/create policy[^;]*on public\.admin_audit_log\s+for\s+(insert|update|delete|all)/i)
  })

  it("plan_history is admin-only for select and has no write policy for users", () => {
    expect(access).toMatch(/alter table public\.plan_history enable row level security/i)
    expect(access).not.toMatch(/create policy[^;]*on public\.plan_history\s+for\s+(insert|update|delete|all)/i)
  })

  it("plan and plan_until stay writable only by the service role", () => {
    expect(access).toMatch(/new\.plan_until is distinct from old\.plan_until/i)
    expect(access).toMatch(/<>\s*'service_role'/i)
  })

  it("the activity table has RLS on and no policy at all", () => {
    const sql = stripComments(migrations.find((m) => m.file.includes("last_seen"))!.sql)
    expect(sql).toMatch(/alter table public\.user_activity_hourly enable row level security/i)
    expect(sql).not.toMatch(/create policy[^;]*user_activity_hourly/i)
    expect(sql).not.toMatch(/\b(title|description|content|body|vault)\b/i)
  })
})

describe("secret key handling", () => {
  const sources = walk(join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))

  it("SUPABASE_SECRET_KEY is read in one server-only module and nowhere else under src/", () => {
    const readers = sources.filter((f) => /process\.env\.SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY/.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f).replace(/\\/g, "/"))
    expect(readers).toEqual(["src/lib/admin/secret.ts"])
    expect(readFileSync(join(ROOT, "src/lib/admin/secret.ts"), "utf8")).toMatch(/^import "server-only"/m)
  })

  it("no client component imports the secret module (or the audit writer)", () => {
    for (const file of sources) {
      const text = readFileSync(file, "utf8")
      if (!/^["']use client["']/m.test(text)) continue
      // `import type` is erased at build time, so it cannot pull a server-only module into the bundle.
      const risky = /^import\s+(?!type\b)[^\n]*@\/lib\/admin\/(secret"|audit|guard|data"|status)/m.test(text)
      expect(risky, `${relative(ROOT, file)} imports a server-only admin module`).toBe(false)
    }
  })

  it("the key is never exposed through a NEXT_PUBLIC_ variable", () => {
    for (const file of [...sources, join(ROOT, ".env.example")]) {
      expect(/NEXT_PUBLIC_[A-Z_]*SECRET/.test(readFileSync(file, "utf8")), relative(ROOT, file)).toBe(false)
    }
  })
})

describe("admin write actions", () => {
  const actions = readFileSync(join(ROOT, "src/features/admin/actions.ts"), "utf8")

  it("is a server-actions module", () => {
    expect(actions.trimStart().startsWith('"use server"')).toBe(true)
  })

  it("every exported action re-checks admin (begin() -> requireAdminForAction) before doing anything", () => {
    expect(actions).toMatch(/const admin = await requireAdminForAction\(\)/)
    const exported = [...actions.matchAll(/export async function (\w+)\(([^)]*)\)[^{]*\{([\s\S]*?)\n\}/g)]
    expect(exported.map((m) => m[1]).sort()).toEqual(["changePlan", "exportUsersCsv", "exportWaitlistCsv", "resendConfirmation", "setSuspended", "signOutEverywhere"])
    for (const [, name, , body] of exported) expect(body, name).toMatch(/await begin\(\)/)
  })

  it("every write is followed by an audit entry (finish() / logAdminAction)", () => {
    const exported = [...actions.matchAll(/export async function (\w+)\(([^)]*)\)[^{]*\{([\s\S]*?)\n\}/g)]
    for (const [, name, , body] of exported) expect(body, name).toMatch(/return finish\(|logAdminAction\(/)
  })
})
