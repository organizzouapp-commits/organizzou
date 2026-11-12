import type { SupabaseClient } from "@supabase/supabase-js"
import { zipSync, strToU8 } from "fflate"
import { NextResponse, type NextRequest } from "next/server"

import { EXPORT_MODULES, EXPORT_SCHEMA_VERSION, exportFilename, PROFILE_COLUMNS, toCsv, VAULT_NOTE } from "@/features/export/format"
import { createLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"

// "Exportar meus dados". Everything is read with the signed-in person's OWN session, so row level security decides what comes back: there
// is no service key here and no way to ask for someone else's rows. Nothing is logged. The Cofre is encrypted on the device and never
// reaches the server, so the export only says so.

const limiter = createLimiter({ max: 3, windowMs: 60 * 60 * 1000 })
const PAGE = 1000
/** A hard ceiling per table keeps one huge account from exhausting the server. */
const MAX_ROWS = 100_000

type Row = Record<string, unknown>

async function readTable(supabase: SupabaseClient, table: string, userId: string): Promise<Row[] | null> {
  const rows: Row[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const query = table === "profiles" ? supabase.from(table).select(PROFILE_COLUMNS).eq("id", userId) : supabase.from(table).select("*")
    const { data, error } = await query.range(from, from + PAGE - 1)
    // A table that does not exist yet (the database update can land after the app update) is skipped, not an error.
    if (error) return rows.length > 0 ? rows : null
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json"
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return NextResponse.json({ error: "Sua sessão expirou. Entre de novo." }, { status: 401 })

  const allowed = limiter.hit(userId)
  if (!allowed.ok) {
    const minutes = Math.ceil(allowed.retryAfterMs / 60_000)
    return NextResponse.json({ error: `Você já exportou os seus dados algumas vezes agora há pouco. Tente de novo em ${minutes} min.` }, { status: 429, headers: { "Retry-After": String(Math.ceil(allowed.retryAfterMs / 1000)) } })
  }

  const exportedAt = new Date()
  const day = exportedAt.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }

  const byTable: Record<string, Row[]> = {}
  const modules: Record<string, Record<string, Row[]>> = {}
  for (const { module, tables } of EXPORT_MODULES) {
    modules[module] = {}
    for (const table of tables) {
      const rows = await readTable(supabase, table, userId)
      if (rows === null) continue
      modules[module][table] = rows
      byTable[table] = rows
    }
  }

  if (format === "json") {
    const body = JSON.stringify({ schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: exportedAt.toISOString(), app: "organizzou", modules, vault: { included: false, note: VAULT_NOTE } }, null, 2)
    return new NextResponse(body, { headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${exportFilename(day, "json")}"` } })
  }

  const files: Record<string, Uint8Array> = {}
  for (const { module, tables } of EXPORT_MODULES) for (const table of tables) if (byTable[table]) files[`${module}/${table}.csv`] = strToU8(toCsv(byTable[table]))
  files["LEIA-ME.txt"] = strToU8(`Exportação da Organizzou em ${exportedAt.toISOString()}.\r\nUm arquivo CSV por tabela, separado por ponto e vírgula, com valores em reais (vírgula decimal) e datas em ISO mais uma coluna no formato dd/mm/aaaa.\r\n\r\n${VAULT_NOTE}\r\n`)
  const zip = zipSync(files, { level: 6 })
  return new NextResponse(new Uint8Array(zip), { headers: { ...headers, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${exportFilename(day, "zip")}"` } })
}
