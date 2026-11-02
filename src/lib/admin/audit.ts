import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type AuditEntry = {
  adminId: string
  adminEmail: string
  /** Dotted verb, e.g. "plan.change", "user.suspend". */
  action: string
  targetUserId?: string
  targetEmail?: string
  /** What changed. Account data only: never any content of the person's modules. */
  payload?: Record<string, unknown>
}

/** Appends to admin_audit_log. Insert is allowed only for the secret key (RLS has no insert policy), so pass `createSecretClient()`. */
export async function logAdminAction(secret: SupabaseClient, entry: AuditEntry) {
  const { error } = await secret.from("admin_audit_log").insert({
    admin_id: entry.adminId,
    admin_email: entry.adminEmail,
    action: entry.action,
    target_user_id: entry.targetUserId ?? null,
    target_email: entry.targetEmail ?? null,
    payload: entry.payload ?? {},
  })
  return { ok: !error }
}
