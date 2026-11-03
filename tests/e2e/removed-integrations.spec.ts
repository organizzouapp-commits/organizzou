/**
 * WhatsApp and Open Finance were removed from the product (docs/REMOVAL-WHATSAPP-OPENFINANCE.md): nothing in the UI or the API
 * may offer them. The assistant lives only in the app.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test removed-integrations
 */
import { expect, test } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
  await context.addCookies([{ name: "dev_plan", value: "free", url: baseURL! }])
})

test("Configurações has no WhatsApp tab; Avisos has no WhatsApp column and offers App and E-mail", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard/configuracoes")
  const nav = page.getByRole("navigation", { name: "Seções" })
  await expect(nav).toBeVisible({ timeout: 30000 })
  await expect(nav.getByRole("button", { name: "WhatsApp" })).toHaveCount(0)
  await nav.getByRole("button", { name: "Avisos" }).click()
  await expect(page.getByText("E-mail", { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/whatsapp/i)).toHaveCount(0)
  // The old deep link opens the default section instead of a WhatsApp screen.
  await page.goto("/dashboard/configuracoes?aba=whatsapp")
  await expect(page.getByText(/whatsapp/i)).toHaveCount(0)
  await nav.getByRole("button", { name: "Segurança e dados" }).click()
  await expect(page.getByText(/open finance/i)).toHaveCount(0)
})

test("login and cadastro show the new steps", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/login")
  for (const step of ["Veja seu dia organizado", "Fale com o assistente", "Receba lembretes diariamente"]) await expect(page.getByRole("button", { name: step })).toBeVisible()
  await page.goto("/cadastro")
  for (const step of ["Crie sua conta agora", "Organize seu dia a dia", "Peça pelo assistente"]) await expect(page.getByRole("button", { name: step })).toBeVisible()
  await expect(page.getByText(/whatsapp/i)).toHaveCount(0)
})

test("Plano page promises nothing that was removed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard/plano")
  await expect(page.getByText("Plano Pro").first()).toBeVisible({ timeout: 30000 })
  await expect(page.getByText(/whatsapp|open finance|banco conectado|bancos/i)).toHaveCount(0)
})

test("Finanças has no Conectar banco", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard/financas")
  await expect(page.getByRole("tab", { name: "Lançamentos" })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole("button", { name: "Conectar banco" })).toHaveCount(0)
  await expect(page.getByText(/open finance/i)).toHaveCount(0)
})

test("sidebar, header and avatar menu have no WhatsApp entry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/dashboard")
  await expect(page.getByText("Desbloqueie o Plano Pro")).toBeVisible({ timeout: 30000 })
  await expect(page.getByText(/whatsapp/i)).toHaveCount(0)
  await page.getByRole("button", { name: "Menu da conta" }).click()
  await expect(page.getByRole("menu").getByText(/whatsapp/i)).toHaveCount(0)
})

test("/api/whatsapp/* answers 404", async ({ request }) => {
  for (const path of ["/api/whatsapp", "/api/whatsapp/webhook", "/api/whatsapp/link"]) {
    expect((await request.get(path)).status()).toBe(404)
    expect((await request.post(path, { data: {} })).status()).toBe(404)
  }
})
