import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")

describe("admin billing", () => {
  const sql = read("supabase/migrations/20261118000003_admin_billing.sql")
  it("the reader is admin-only, additive, and leaves out documents, links and texts", () => {
    expect(sql).toMatch(/if not public\.is_admin\(\) then raise exception 'forbidden'; end if;/)
    expect(sql).toMatch(/revoke all on function admin\.billing_by_user\(\) from public, anon/)
    expect(sql).toMatch(/grant execute on function admin\.billing_by_user\(\) to authenticated/)
    expect(sql).not.toMatch(/cpf|cnpj|invoice_url|asaas_customer|drop |alter table/i)
    expect(sql).toContain("admin_counts_user")
  })
  it("the page shows plan, period, method, status and last invoice, and points to the audited plan change", () => {
    const page = read("src/app/(admin)/admin/assinaturas/page.tsx")
    for (const text of ["Plano", "Período", "Forma", "Assinatura", "Última fatura", "Alterar plano"]) expect(page).toContain(text)
    expect(page).toContain("billingByUser")
  })
  it("granting or revoking Pro by hand is the existing audited action", () => {
    const actions = read("src/features/admin/actions.ts")
    expect(actions).toContain('action: "plan.change"')
    expect(actions).toMatch(/requireAdminForAction|requireAdmin/)
  })
})

describe("admin: subscriptions pending cleanup", () => {
  it("the orphans are read and cleaned only after the admin checks, and only recorded ones can be deleted", () => {
    const reader = read("src/lib/admin/billing-orphans.ts")
    expect(reader.indexOf("await requireAdmin()")).toBeGreaterThan(-1)
    expect(reader.indexOf("await requireAdmin()")).toBeLessThan(reader.indexOf("createSecretClient()"))
    const action = read("src/features/admin/billing-actions.ts")
    expect(action.indexOf("requireAdminForAction()")).toBeLessThan(action.indexOf("createSecretClient()"))
    expect(action).toContain("openOrphans()")
    expect(action).toContain("não está na lista de pendentes")
    expect(action).toContain('action: "billing.orphan_cleanup"')
  })
  it("the page lists them with a retry button, and the record holds only the Asaas id and our user id", () => {
    expect(read("src/app/(admin)/admin/assinaturas/page.tsx")).toContain("Pendentes de limpeza")
    expect(read("src/lib/billing/store.ts")).toContain("payload: { subscription: asaasSubscriptionId, user_id: userId }")
  })
})

describe("admin: Pro manual is told apart from a paid subscription", () => {
  it("only Pro accounts with no live subscription are manual", async () => {
    const { splitManual } = await import("./billing-extra")
    const pros = [{ id: "a" }, { id: "b" }, { id: "c" }]
    expect(splitManual(pros, ["b"])).toEqual([{ id: "a" }, { id: "c" }])
    expect(splitManual(pros, [])).toEqual(pros)
    expect(splitManual([], ["x"])).toEqual([])
  })
  it("the page shows the Pro manual badge, and the reader checks the admin before the secret key", () => {
    expect(read("src/app/(admin)/admin/assinaturas/page.tsx")).toContain("Pro manual")
    const reader = read("src/lib/admin/billing-extra.ts")
    expect(reader.indexOf("await requireAdmin()")).toBeLessThan(reader.indexOf("createSecretClient()"))
  })
})

describe("admin: who used the launch price", () => {
  it("the reader checks the admin first and counts only paid invoices of at most the launch price", () => {
    const reader = read("src/lib/admin/billing-extra.ts")
    const fn = reader.slice(reader.indexOf("export async function launchPriceUsers"))
    expect(fn.indexOf("await requireAdmin()")).toBeLessThan(fn.indexOf("createSecretClient()"))
    expect(fn).toContain('.lte("amount_cents", LAUNCH_PRICE_CENTS)')
    expect(fn).toContain("PAID_STATUSES")
    expect(fn).toContain('.select("user_id")') // ids only: no document, no link, no text
  })
  it("the table has the column", () => {
    const page = read("src/app/(admin)/admin/assinaturas/page.tsx")
    for (const text of ["Preço de lançamento", "Já usou", "Não usou"]) expect(page).toContain(text)
  })
})
