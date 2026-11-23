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
