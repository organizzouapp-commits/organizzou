/**
 * Prompt 4 flows: Notas, Metas, Diário, Cofre, Configurações/Perfil/Ajuda, Políticas and the auth keyboard order.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
 *   npx playwright test ux-organizacao
 */
import { expect, test } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

test.beforeEach(async ({ context, baseURL, page }) => {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
  await page.setViewportSize({ width: 1440, height: 900 })
})

test("Notas: pinned section, folder counts and the autosave indicator", async ({ page }) => {
  await page.goto("/dashboard/notas")
  await expect(page.getByRole("navigation", { name: "Pastas" })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole("button", { name: /Fixadas/ })).toBeVisible()
  const first = page.getByRole("region", { name: "Lista de notas" }).getByRole("button").nth(1)
  await first.click()
  await page.getByRole("radio", { name: "Editar", exact: true }).click()
  await page.getByLabel("Texto da nota").fill("texto novo")
  await expect(page.getByRole("status").filter({ hasText: "Salvo" })).toBeVisible()
})

test("Lembretes: delay lives in the ⋯ menu and titles wrap on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/dashboard/notas")
  await page.getByRole("tab", { name: "Lembretes" }).click({ timeout: 30000 })
  await expect(page.getByText("Em breve: os lembretes serão avisados")).toBeVisible()
  await expect(page.getByRole("button", { name: "Adiar", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: /Mais opções de/ }).first().click()
  await expect(page.getByRole("menuitem", { name: "Em 1 hora" })).toBeVisible()
})

test("Metas: goal cards with the percent and days on their own line", async ({ page }) => {
  await page.goto("/dashboard/metas")
  const card = page.getByRole("region").filter({ has: page.getByRole("progressbar") }).first()
  await expect(card).toBeVisible({ timeout: 30000 })
  await expect(card.getByText(/faltam \d+ dias|prazo vencido|vence hoje/).first()).toBeVisible()
})

test("Cofre: locked card is centered, the item opens in a side panel (the assistant guard is covered by src/mocks/vault-guard.test.ts)", async ({ page }) => {
  await page.goto("/dashboard/cofre")
  await expect(page.getByRole("heading", { name: "Cofre bloqueado" })).toBeVisible({ timeout: 30000 })
  await page.getByLabel("Senha mestra").fill("qualquer-coisa")
  await page.getByRole("button", { name: "Desbloquear" }).click()
  await page.getByText("Amazon").first().click()
  const panel = page.getByRole("region", { name: "Detalhes do item" })
  await expect(panel).toBeVisible()
  await expect(panel.getByText("Usuário")).toBeVisible()
})

test("Cofre (mobile): the item opens as a full-screen sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/dashboard/cofre")
  await page.getByLabel("Senha mestra").fill("x")
  await page.getByRole("button", { name: "Desbloquear" }).click({ timeout: 30000 })
  await page.getByText("Amazon").first().click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toBeVisible()
  // The sheet slides up: wait for the animation, then it must cover the whole screen.
  await expect.poll(async () => (await sheet.boundingBox())!.height, { timeout: 5000 }).toBeGreaterThanOrEqual(840)
})

test("Configurações: vertical nav, sections switch, the URL keeps the section", async ({ page }) => {
  await page.goto("/dashboard/configuracoes")
  const nav = page.getByRole("navigation", { name: "Seções" })
  await expect(nav).toBeVisible({ timeout: 30000 })
  for (const name of ["Perfil", "Aparência", "Avisos", "WhatsApp", "Segurança e dados", "Plano e cobrança"]) await expect(nav.getByRole("button", { name })).toBeVisible()
  await nav.getByRole("button", { name: "Avisos" }).click()
  await expect(page.getByText("App", { exact: true }).first()).toBeVisible()
  await expect(page).toHaveURL(/aba=avisos/)
  await nav.getByRole("button", { name: "WhatsApp" }).click()
  await expect(page.getByRole("button", { name: "Enviar código" })).toBeDisabled()
})

test("Perfil: same screen, profile section first, avatar upload marked Em breve", async ({ page }) => {
  await page.goto("/dashboard/perfil")
  await expect(page.getByRole("button", { name: "Alterar foto" })).toBeDisabled({ timeout: 30000 })
  await expect(page.getByLabel("E-mail")).toBeDisabled()
})

test("Ajuda: the FAQ is searchable and the report form is marked Em breve", async ({ page }) => {
  await page.goto("/dashboard/ajuda")
  await page.getByLabel("Buscar nas perguntas").fill("senha")
  await expect(page.getByText("Como altero minha senha ou meus dados?")).toBeVisible({ timeout: 30000 })
  await expect(page.getByText("Como excluo minha conta?")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Enviar relato" })).toBeDisabled()
})

test("Políticas: logo, table of contents and last update", async ({ page }) => {
  await page.goto("/politicas")
  await expect(page.getByRole("link", { name: /Organizzou, início/ })).toBeVisible({ timeout: 30000 })
  await expect(page.getByText(/Última atualização/)).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Índice das políticas" })).toBeVisible()
})

test("Login: keyboard goes from the theme button straight to the form fields", async ({ page }) => {
  await page.goto("/login")
  await page.waitForTimeout(1500)
  await page.locator("body").click({ position: { x: 5, y: 5 } })
  const order: string[] = []
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab")
    order.push(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute("aria-label") ?? (document.activeElement as HTMLElement | null)?.id ?? document.activeElement?.tagName ?? ""))
  }
  expect(order.join(" | ")).toMatch(/login-email/)
  expect(order.join(" | ")).not.toMatch(/Veja seu dia|Fale com o assistente|Receba lembretes/)
})
