import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

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
