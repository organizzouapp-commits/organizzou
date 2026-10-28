/**
 * Key flows touched by the UX review (prompt 1): toasts, weight chart, tabs, auth layout, honest integrations, Plano Pro.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
 *   npx playwright test ux-foundation
 */
import { expect, test, type BrowserContext } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function withConsent(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
}

test.beforeEach(async ({ context, baseURL }) => withConsent(context, baseURL!))

test("Dieta > Peso: registering a weight updates the card and keeps one point per day", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard/dieta")
  await page.getByRole("tab", { name: "Peso" }).click()
  const before = await page.locator("svg.recharts-surface circle, svg.recharts-surface .recharts-dot").count()
  await page.getByRole("button", { name: "Registrar peso" }).click()
  await page.getByLabel("Peso (kg)").fill("79,3")
  await page.getByRole("button", { name: /salvar|registrar/i }).last().click()
  await expect(page.getByText("79,3 kg").first()).toBeVisible()
  // The mock already has a weigh-in today: the new one replaces it, the point count does not grow.
  await page.waitForTimeout(500)
  const after = await page.locator("svg.recharts-surface circle, svg.recharts-surface .recharts-dot").count()
  expect(after).toBe(before)
})

test("toasts appear at the top, never over the assistant button", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard")
  await page.getByRole("checkbox").first().click()
  const toast = page.locator("[data-sonner-toast]").first()
  await expect(toast).toBeVisible()
  const box = (await toast.boundingBox())!
  expect(box.y).toBeLessThan(200)
  expect(box.x + box.width).toBeGreaterThan(1440 - 80)
  await expect(toast).toBeHidden({ timeout: 6000 })
})

test("mobile toast is top-centered below the safe area", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/dashboard")
  await page.getByRole("checkbox").first().click()
  const toast = page.locator("[data-sonner-toast]").first()
  await expect(toast).toBeVisible()
  const box = (await toast.boundingBox())!
  expect(box.y).toBeLessThan(160)
  expect(Math.abs(box.x + box.width / 2 - 195)).toBeLessThan(20)
})

test("tabs never cut a label on a phone: they scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto("/dashboard/financas")
  const list = page.getByRole("tablist").first()
  await expect(list).toBeVisible()
  const overflowX = await list.evaluate((el) => getComputedStyle(el).overflowX)
  expect(overflowX).toBe("auto")
  await page.getByRole("tab", { name: "Metas" }).click()
  const inView = await page.getByRole("tab", { name: "Metas" }).evaluate((el) => {
    const r = el.getBoundingClientRect()
    const l = el.parentElement!.getBoundingClientRect()
    return r.left >= l.left - 1 && r.right <= l.right + 1
  })
  expect(inView).toBe(true)
})

test("desktop /cadastro: the legal links keep a gap from the form", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto("/cadastro")
  await page.waitForTimeout(3300)
  const link = page.getByRole("link", { name: "Termos de uso" }).first()
  const form = page.getByRole("button", { name: "Continuar com Google" }).first()
  const l = (await link.boundingBox())!
  const f = (await form.boundingBox())!
  expect(l.y - (f.y + f.height)).toBeGreaterThan(24)
})

test("mobile /politicas: the sticky index sits above the text, nothing overlaps", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/politicas")
  const nav = page.getByRole("navigation", { name: "Índice das políticas" })
  const title = page.getByRole("heading", { name: "Políticas do Organizzou" })
  const n = (await nav.boundingBox())!
  const t = (await title.boundingBox())!
  expect(t.y).toBeGreaterThanOrEqual(n.y + n.height)
  await page.evaluate(() => window.scrollTo(0, 400))
  await page.waitForTimeout(300)
  const after = (await nav.boundingBox())!
  expect(after.y).toBeLessThanOrEqual(24)
})

test("simulated integrations are marked and disabled, never claim success", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard/configuracoes?aba=whatsapp")
  await expect(page.getByText("Em breve").first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Enviar código" })).toBeDisabled()
  await page.goto("/dashboard/financas")
  await page.getByRole("button", { name: "Conectar banco" }).click()
  await expect(page.getByText("Conectado", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Em breve" }).first()).toBeDisabled()
})

test("Plano Pro: entry points and the waiting list dialog", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard")
  await expect(page.getByRole("link", { name: "Fazer upgrade" }).first()).toBeVisible()
  await page.getByRole("link", { name: "Fazer upgrade" }).first().click()
  await expect(page).toHaveURL(/\/dashboard\/plano/)
  await page.getByRole("button", { name: "Fazer upgrade" }).click()
  await expect(page.getByText("O pagamento chega em breve")).toBeVisible()
  await expect(page.locator("#wl-email")).toHaveValue("visitante@organizzou.app")
})

test("below 1280 px the header upgrade button hides (it stays in the avatar menu)", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 })
  await page.goto("/dashboard")
  await expect(page.locator("header").getByRole("link", { name: "Fazer upgrade" })).toBeHidden()
  await page.getByRole("button", { name: "Menu da conta" }).click()
  await expect(page.getByRole("menuitem", { name: "Ver planos" })).toBeVisible()
})
