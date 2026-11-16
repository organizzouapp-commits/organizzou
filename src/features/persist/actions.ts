"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

import { isTableName, TABLES, withoutPending } from "./registry"
import { friendlySaveError, isMissingColumn } from "./save-errors"

/** `degraded`: saved, but without the columns of a prepared migration that is not applied yet (the screen keeps those on this device). */
export type PersistResult = { ok: true; degraded?: boolean } | { ok: false; error: string }

const MAX_ROWS = 500

const input = z.object({
  table: z.string(),
  upserts: z.array(z.unknown()).max(MAX_ROWS),
  deletes: z.array(z.uuid()).max(MAX_ROWS),
})

/**
 * Saves what a screen changed in one table: removes the given rows, then creates or updates the others. Rows are validated against
 * the table's schema (src/features/persist/registry.ts), `user_id` is always the signed-in person, and RLS has the last word:
 * a row that belongs to someone else cannot be touched. Deletes go first so a row replaced by one with the same natural key
 * (a habit log of the same day) never collides with itself.
 */
export async function persistRows(raw: z.input<typeof input>): Promise<PersistResult> {
  const parsed = input.safeParse(raw)
  if (!parsed.success || !isTableName(parsed.data.table)) return { ok: false, error: "Dados inválidos." }
  const { table, upserts, deletes } = parsed.data
  const config = TABLES[table]

  const rows: Record<string, unknown>[] = []
  for (const row of upserts) {
    const checked = config.schema.safeParse(row)
    if (!checked.success) return { ok: false, error: `Dados inválidos: ${checked.error.issues[0]?.path.join(".") || "linha"}.` }
    rows.push(checked.data)
  }

  // The generated Database types only know the original tables; the new ones are validated by the registry instead.
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }

  if (deletes.length > 0) {
    const { error } = await supabase.from(table).delete().in("id", deletes)
    if (error) return { ok: false, error: "Não foi possível apagar." }
  }
  let degraded = false
  if (rows.length > 0) {
    const send = (list: Record<string, unknown>[]) =>
      supabase.from(table).upsert(
        list.map((row) => ({ ...row, user_id: userId })),
        { onConflict: config.pk }
      )
    let { error } = await send(rows)
    // The migration that adds these columns is prepared but not applied: save the rest and let the screen keep the new fields on this device.
    if (error && config.pending.length > 0 && isMissingColumn(error)) {
      degraded = true
      ;({ error } = await send(withoutPending(config, rows)))
    }
    if (error) return { ok: false, error: friendlySaveError(error) }
  }
  return degraded ? { ok: true, degraded: true } : { ok: true }
}
