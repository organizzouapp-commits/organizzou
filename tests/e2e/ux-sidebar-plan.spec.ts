/**
 * Sidebar and profile menu by plan / WhatsApp state. The dev-only cookies dev_plan and dev_whatsapp (honored only where the
 * login bypass is) switch the state.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test ux-sidebar-plan
 */
import { expect, test, type BrowserContext } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const SIDEBAR_COOKIE = "sidebar_state_00000000000040008000000000000001"

async function setup(context: BrowserContext, baseURL: string, plan: "free" | "pro", whatsapp: boolean, open = true) {
  await context.addCookies([
    { name: "organizzou_consent", value: CONSENT, url: baseURL },
    { name: "dev_plan", value: plan, url: baseURL },
    { name: "dev_whatsapp", value: whatsapp ? "1" : "0", url: baseURL },
    { name: SIDEBAR_COOKIE, value: String(open), url: baseURL },
  ])
}

test.beforeEach(async ({ page }) => {
  // Taller than 900 px: on shorter screens the card drops its description by design.
  await page.setViewportSize({ width: 1440, height: 1000 })
})

test("Free, expanded: Configurações follows Organização, no upgrade row, the card sells the Pro plan", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!, "free", false)
  await page.goto("/dashboard")
  const nav = page.getByRole("navigation", { name: "Módulos" }).first()
  await expect(nav.getByRole("button", { name: "Configurações" })).toBeVisible({ timeout: 30000 })
  const org = (await nav.getByRole("button", { name: "Organização" }).boundingBox())!
  const cfg = (await nav.getByRole("button", { name: "Configurações" }).boundingBox())!
  expect(cfg.y).toBeGreaterThan(org.y)
  expect(cfg.y - org.y).toBeLessThan(60)
  await expect(page.getByText("Desbloqueie o Plano Pro")).toBeVisible()
  await expect(page.getByText("Assistente no WhatsApp, lembretes e muito mais.")).toBeVisible()
  await expect(page.getByText("Conecte seu WhatsApp")).toHaveCount(0)
  // The old Lima row is gone: the only "Fazer upgrade" in the sidebar is the card's button.
  await expect(page.locator("[data-sidebar=sidebar]").getByRole("link", { name: "Fazer upgrade" })).toHaveCount(1)
})

test("Pro without WhatsApp: the connect card; Pro with WhatsApp: no card", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!, "pro", false)
  await page.goto("/dashboard")
  await expect(page.getByText("Conecte seu WhatsApp")).toBeVisible({ timeout: 30000 })
  await expect(page.getByText("Desbloqueie o Plano Pro")).toHaveCount(0)
  await context.addCookies([{ name: "dev_whatsapp", value: "1", url: baseURL! }])
  await page.reload()
  await expect(page.getByRole("button", { name: "Configurações" }).first()).toBeVisible({ timeout: 30000 })
  await expect(page.getByText("Conecte seu WhatsApp")).toHaveCount(0)
  await expect(page.getByText("Desbloqueie o Plano Pro")).toHaveCount(0)
})

test("Collapsed rail: the gear sits with the module icons, Free sees the upgrade button, WhatsApp is locked in the flyout", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!, "free", false, false)
  await page.goto("/dashboard")
  const rail = page.locator("[data-sidebar=sidebar]")
  const gear = rail.getByRole("button", { name: "Configurações" })
  await expect(gear).toBeVisible({ timeout: 30000 })
  const org = (await rail.getByRole("button", { name: "Organização" }).boundingBox())!
  const g = (await gear.boundingBox())!
  expect(g.y - org.y).toBeLessThan(70)
  await expect(rail.getByRole("link", { name: "Fazer upgrade" })).toBeVisible()
  await gear.click()
  const item = page.getByRole("link", { name: /Conectar WhatsApp/ })
  await expect(item).toBeVisible()
  await expect(item).toContainText("Plano Pro")
  await expect(item).toHaveAttribute("href", "/dashboard/plano")
})

test("Pro, collapsed: no upgrade button in the rail", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!, "pro", false, false)
  await page.goto("/dashboard")
  await expect(page.getByRole("button", { name: "Configurações" }).first()).toBeVisible({ timeout: 30000 })
  await expect(page.locator("[data-sidebar=sidebar]").getByRole("link", { name: "Fazer upgrade" })).toHaveCount(0)
})

test("Profile menu: plan badge and a round arrow, no upgrade button inside", async ({ page, context, baseURL }) => {
  for (const plan of ["free", "pro"] as const) {
    await setup(context, baseURL!, plan, false)
    await page.goto("/dashboard")
    await page.getByRole("button", { name: "Menu da conta" }).click({ timeout: 30000 })
    const menu = page.getByRole("menu")
    const badge = menu.getByText(plan === "pro" ? "Plano Pro" : "Plano Gratuito", { exact: true })
    await expect(badge).toBeVisible()
    await expect(badge).toHaveClass(plan === "pro" ? /bg-highlight/ : /bg-muted/)
    await expect(menu.getByRole("menuitem", { name: "Ver planos" })).toBeVisible()
    await expect(menu.getByRole("link", { name: "Fazer upgrade" })).toHaveCount(0)
    await page.keyboard.press("Escape")
  }
})
