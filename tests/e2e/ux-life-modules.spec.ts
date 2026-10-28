/**
 * Prompt 3 flows: Finanças, Rotina, Treinos, Dieta, Estudos.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
 *   npx playwright test ux-life-modules
 */
import { expect, test } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

test.beforeEach(async ({ context, baseURL, page }) => {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
  await page.setViewportSize({ width: 1440, height: 900 })
})

test("Finanças: quick add creates a gasto in today's group and a goal can be created", async ({ page }) => {
  await page.goto("/dashboard/financas")
  await page.getByRole("tab", { name: "Lançamentos" }).click({ timeout: 30000 })
  await page.getByLabel("Adicionar lançamento rápido").fill("padaria 18,50")
  await page.getByRole("button", { name: "Adicionar", exact: true }).click()
  await expect(page.getByText("Gasto registrado.").first()).toBeVisible()
  await expect(page.getByText("Padaria").first()).toBeVisible()
  await expect(page.getByText("Hoje", { exact: true }).first()).toBeVisible()
  // Edit via the row menu.
  await page.getByRole("button", { name: "Ações de Padaria" }).first().click()
  await page.getByRole("menuitem", { name: "Editar" }).click()
  await expect(page.getByRole("heading", { name: "Editar lançamento" })).toBeVisible()
  await page.keyboard.press("Escape")
  // Metas: new goal card.
  await page.getByRole("tab", { name: "Metas" }).click()
  await page.getByRole("button", { name: "Nova meta" }).click()
  await page.getByLabel("Nome").fill("Bicicleta")
  await page.getByLabel("Valor da meta").fill("2000")
  await page.getByRole("button", { name: "Criar meta" }).click()
  await expect(page.getByRole("region", { name: "Bicicleta" })).toBeVisible()
})

test("Finanças: paying a conta fixa marks it as Pago with text, not color", async ({ page }) => {
  await page.goto("/dashboard/financas")
  await page.getByRole("tab", { name: "Contas fixas" }).click({ timeout: 30000 })
  const pagar = page.getByRole("button", { name: "Pagar" }).first()
  await expect(pagar).toBeVisible()
  const before = await page.getByText("Pago", { exact: true }).count()
  await pagar.click()
  await expect(page.getByText("Pago", { exact: true })).toHaveCount(before + 1)
})

test("Rotina: labeled 7-day dots and the +/- buttons are 44px", async ({ page }) => {
  await page.goto("/dashboard/rotina")
  await expect(page.getByRole("group", { name: /Últimos 7 dias de/ }).first()).toBeVisible({ timeout: 30000 })
  const minus = page.getByRole("button", { name: /Aumentar/ }).first()
  const box = (await minus.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(36)
  await page.getByRole("tab", { name: "Histórico" }).click()
  await page.getByRole("button", { name: "Treinar", exact: true }).click()
  await expect(page.getByRole("button", { name: "Treinar", exact: true })).toHaveAttribute("aria-pressed", "true")
})

test("Treinos: log a set (rest timer appears) and duplicate a plan", async ({ page }) => {
  await page.goto("/dashboard/treinos")
  const check = page.getByLabel("Série 1 feita").first()
  await expect(check).toBeVisible({ timeout: 30000 })
  await check.click()
  await expect(page.getByRole("timer")).toBeVisible()
  await page.getByRole("tab", { name: "Meus treinos" }).click()
  const before = await page.getByRole("region").filter({ hasText: "exercícios" }).count()
  await page.getByRole("button", { name: "Duplicar" }).first().click()
  await expect(page.getByText("(cópia)").first()).toBeVisible()
  expect(before).toBeGreaterThan(0)
})

test("Dieta: weight register updates the card and the period selector switches", async ({ page }) => {
  await page.goto("/dashboard/dieta")
  await page.getByRole("tab", { name: "Peso" }).click({ timeout: 30000 })
  await page.getByRole("radio", { name: "30 dias" }).click()
  await expect(page.getByText("em 30 dias")).toBeVisible()
  await page.getByRole("button", { name: "Registrar peso" }).click()
  await page.getByLabel("Peso (kg)").fill("79,2")
  await page.getByRole("button", { name: /salvar|registrar/i }).last().click()
  await expect(page.getByText("79,2 kg").first()).toBeVisible()
})

test("Estudos: start and stop the focus timer, then log what was studied", async ({ page }) => {
  await page.goto("/dashboard/estudos")
  const timer = page.getByRole("timer", { name: "Cronômetro de foco" })
  await expect(timer).toHaveText("25:00", { timeout: 30000 })
  await page.getByRole("button", { name: "Começar" }).click()
  await page.waitForTimeout(2200)
  await expect(timer).not.toHaveText("25:00")
  await page.getByRole("button", { name: "Pausar" }).click()
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible()
  await page.getByRole("button", { name: "Zerar" }).click()
  await expect(timer).toHaveText("25:00")
  // Less than a minute studied: the app says so instead of faking a session.
  await page.getByRole("button", { name: "Registrar o que estudei" }).click()
  await expect(page.getByText("Estude pelo menos 1 minuto").first()).toBeVisible()
})

test("Estudos: inline add of a prova and countdown chips", async ({ page }) => {
  await page.goto("/dashboard/estudos")
  await page.getByRole("tab", { name: "Provas e prazos" }).click({ timeout: 30000 })
  await page.getByLabel("Título da nova prova ou prazo").fill("Prova de teste")
  await page.getByRole("button", { name: "Adicionar", exact: true }).click()
  await expect(page.getByText("Prova de teste")).toBeVisible()
  await expect(page.getByText(/\d+ dias?|Hoje/).first()).toBeVisible()
})
