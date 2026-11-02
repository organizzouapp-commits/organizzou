"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logAdminAction } from "@/lib/admin/audit"
import { listUsers, waitlistList, type UserFilters, type UserRow } from "@/lib/admin/data"
import { toCsv, fmtDate, fmtDateTime } from "@/lib/admin/format"
import { requireAdminForAction } from "@/lib/admin/guard"
import { createSecretClient, SECRET_KEY_HINT, secretKeyConfigured } from "@/lib/admin/secret"

export type AdminActionResult = { ok: true; message: string } | { ok: false; error: string }

const fail = (error: string): AdminActionResult => ({ ok: false, error })

/** Every action: re-check admin on the server (JWT + database), then the secret key must exist, then write, then log. */
async function begin() {
  const admin = await requireAdminForAction()
  if (!secretKeyConfigured()) return { ok: false, error: SECRET_KEY_HINT } as const
  return { ok: true, admin, secret: createSecretClient() } as const
}

const userId = z.uuid()

async function targetOf(secret: ReturnType<typeof createSecretClient>, id: string) {
  const { data, error } = await secret.auth.admin.getUserById(id)
  if (error || !data.user) return null
  return data.user
}

/** The audit entry is part of the action: when it cannot be written the admin is told, not left with a silent change. */
async function finish(
  ctx: Extract<Awaited<ReturnType<typeof begin>>, { ok: true }>,
  entry: { action: string; targetUserId: string; targetEmail?: string; payload?: Record<string, unknown> },
  message: string
): Promise<AdminActionResult> {
  const logged = await logAdminAction(ctx.secret, { adminId: ctx.admin.adminId, adminEmail: ctx.admin.email, ...entry })
  revalidatePath("/admin", "layout")
  if (!logged.ok) return fail("A ação foi feita, mas o registro de auditoria falhou. Avise quem cuida do servidor.")
  return { ok: true, message }
}

const planInput = z.object({
  userId,
  plan: z.enum(["free", "pro"]),
  /** Courtesy end date (yyyy-MM-dd, São Paulo). Only for Pro; empty = no end. */
  until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
})

export async function changePlan(input: z.input<typeof planInput>): Promise<AdminActionResult> {
  const parsed = planInput.safeParse(input)
  if (!parsed.success) return fail("Dados inválidos.")
  const ctx = await begin()
  if (!ctx.ok) return fail(ctx.error)

  const { userId: id, plan } = parsed.data
  // End of the chosen day in São Paulo (UTC-3, no daylight saving).
  const until = plan === "pro" && parsed.data.until ? new Date(`${parsed.data.until}T23:59:59-03:00`) : null
  if (until && until.getTime() <= Date.now()) return fail("A data de fim precisa estar no futuro.")

  const target = await targetOf(ctx.secret, id)
  if (!target) return fail("Usuário não encontrado.")

  const { error } = await ctx.secret
    .from("profiles")
    .update({ plan, plan_until: until ? until.toISOString() : null })
    .eq("id", id)
  if (error) return fail("Não foi possível alterar o plano. A migration do painel admin já foi aplicada?")

  await ctx.secret.from("plan_history").insert({
    user_id: id,
    plan,
    kind: plan === "pro" && until ? "courtesy" : "admin",
    until: until ? until.toISOString() : null,
    changed_by: ctx.admin.adminId,
  })

  return finish(
    ctx,
    { action: "plan.change", targetUserId: id, targetEmail: target.email, payload: { plan, until: until?.toISOString() ?? null } },
    plan === "pro" ? (until ? "Pro de cortesia ativado." : "Plano Pro ativado.") : "Plano alterado para Gratuito."
  )
}

const suspendInput = z.object({ userId, suspended: z.boolean() })

export async function setSuspended(input: z.input<typeof suspendInput>): Promise<AdminActionResult> {
  const parsed = suspendInput.safeParse(input)
  if (!parsed.success) return fail("Dados inválidos.")
  const ctx = await begin()
  if (!ctx.ok) return fail(ctx.error)

  const { userId: id, suspended } = parsed.data
  if (id === ctx.admin.adminId) return fail("Você não pode suspender a própria conta.")
  const target = await targetOf(ctx.secret, id)
  if (!target) return fail("Usuário não encontrado.")

  // A ban of ~100 years is the suspension; "none" lifts it. A banned user cannot sign in or refresh a session.
  const { error } = await ctx.secret.auth.admin.updateUserById(id, { ban_duration: suspended ? "876000h" : "none" })
  if (error) return fail("Não foi possível alterar o acesso desta conta.")

  return finish(
    ctx,
    { action: suspended ? "user.suspend" : "user.reactivate", targetUserId: id, targetEmail: target.email },
    suspended ? "Conta suspensa." : "Conta reativada."
  )
}

const idOnly = z.object({ userId })

export async function resendConfirmation(input: z.input<typeof idOnly>): Promise<AdminActionResult> {
  const parsed = idOnly.safeParse(input)
  if (!parsed.success) return fail("Dados inválidos.")
  const ctx = await begin()
  if (!ctx.ok) return fail(ctx.error)

  const target = await targetOf(ctx.secret, parsed.data.userId)
  if (!target?.email) return fail("Usuário não encontrado.")
  if (target.email_confirmed_at) return fail("Este e-mail já foi confirmado.")

  const { error } = await ctx.secret.auth.resend({ type: "signup", email: target.email })
  if (error) return fail("Não foi possível reenviar o e-mail de confirmação agora.")

  return finish(ctx, { action: "user.resend_confirmation", targetUserId: target.id, targetEmail: target.email }, "E-mail de confirmação reenviado.")
}

export async function signOutEverywhere(input: z.input<typeof idOnly>): Promise<AdminActionResult> {
  const parsed = idOnly.safeParse(input)
  if (!parsed.success) return fail("Dados inválidos.")
  const ctx = await begin()
  if (!ctx.ok) return fail(ctx.error)

  const target = await targetOf(ctx.secret, parsed.data.userId)
  if (!target) return fail("Usuário não encontrado.")

  // The function lives in the admin schema and checks is_admin() itself, so it runs with the admin's own session.
  const { data, error } = await ctx.admin.supabase.schema("admin").rpc("revoke_user_sessions", { target: target.id })
  if (error) return fail("Não foi possível encerrar as sessões.")

  return finish(
    ctx,
    { action: "user.sign_out_all", targetUserId: target.id, targetEmail: target.email, payload: { sessions: data ?? 0 } },
    "Todas as sessões foram encerradas."
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// CSV exports. They read with the admin's own session (the SQL functions check is_admin()), and because they copy personal data
// out of the app they are logged like any other admin action: without the server key they are disabled.

export type ExportResult = { ok: true; csv: string; filename: string; rows: number } | { ok: false; error: string }

const EXPORT_PAGE = 200
const EXPORT_MAX_PAGES = 25

const PLAN_LABEL = { free: "Gratuito", pro: "Pro" } as const
const STATUS_LABEL = { active: "Ativo", suspended: "Suspenso", pending: "Aguardando confirmação" } as const

const exportFilters = z.object({
  search: z.string().max(100).nullable(),
  plan: z.enum(["free", "pro"]).nullable(),
  status: z.enum(["active", "suspended", "pending"]).nullable(),
  activity: z.enum(["active", "inactive"]).nullable(),
  from: z.string().regex(/^d{4}-d{2}-d{2}$/).nullable(),
  to: z.string().regex(/^d{4}-d{2}-d{2}$/).nullable(),
  sort: z.enum(["name", "email", "plan", "created_at", "last_seen"]),
  dir: z.enum(["asc", "desc"]),
})

/** The visible columns of the users table, for everyone that matches the current filters (up to 5.000 rows). */
export async function exportUsersCsv(input: UserFilters): Promise<ExportResult> {
  const parsed = exportFilters.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Filtros inválidos." }
  const ctx = await begin()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const rows: UserRow[] = []
  for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
    const result = await listUsers(parsed.data, page, EXPORT_PAGE)
    if (!result.ok) return { ok: false, error: "Não foi possível ler os usuários." }
    rows.push(...result.data)
    if (result.data.length < EXPORT_PAGE) break
  }

  const csv = toCsv(
    ["Nome", "E-mail", "Plano", "Cadastro", "Último acesso", "Login", "WhatsApp vinculado", "Status"],
    rows.map((r) => [r.name ?? "", r.email, PLAN_LABEL[r.plan], fmtDate(r.created_at), fmtDateTime(r.last_seen), r.provider, r.whatsapp_linked ? "Sim" : "Não", STATUS_LABEL[r.status]])
  )
  const logged = await logAdminAction(ctx.secret, { adminId: ctx.admin.adminId, adminEmail: ctx.admin.email, action: "users.export", payload: { rows: rows.length, filters: parsed.data } })
  if (!logged.ok) return { ok: false, error: "Não foi possível registrar a exportação na auditoria, então ela foi cancelada." }
  return { ok: true, csv, filename: `usuarios-${new Date().toISOString().slice(0, 10)}.csv`, rows: rows.length }
}

const waitlistFilters = z.object({ search: z.string().max(100).nullable(), source: z.enum(["em-breve", "plano-pro"]).nullable() })

const SOURCE_LABEL: Record<string, string> = { "em-breve": "Site", "plano-pro": "Plano Pro" }

export async function exportWaitlistCsv(input: { search: string | null; source: string | null }): Promise<ExportResult> {
  const parsed = waitlistFilters.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Filtros inválidos." }
  const ctx = await begin()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const rows: { name: string; email: string; phone: string; source: string; created_at: string }[] = []
  for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
    const result = await waitlistList(parsed.data.search, parsed.data.source, page, 500)
    if (!result.ok) return { ok: false, error: "Não foi possível ler a lista de espera." }
    rows.push(...result.data)
    if (result.data.length < 500) break
  }

  const csv = toCsv(["Nome", "E-mail", "Telefone", "Origem", "Entrou em"], rows.map((r) => [r.name, r.email, r.phone, SOURCE_LABEL[r.source] ?? r.source, fmtDateTime(r.created_at)]))
  const logged = await logAdminAction(ctx.secret, { adminId: ctx.admin.adminId, adminEmail: ctx.admin.email, action: "waitlist.export", payload: { rows: rows.length, filters: parsed.data } })
  if (!logged.ok) return { ok: false, error: "Não foi possível registrar a exportação na auditoria, então ela foi cancelada." }
  return { ok: true, csv, filename: `lista-de-espera-${new Date().toISOString().slice(0, 10)}.csv`, rows: rows.length }
}
