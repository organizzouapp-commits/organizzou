/**
 * Sidebar and profile menu by plan. The dev-only cookie dev_plan (honored only where the login bypass is) switches the plan.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test ux-sidebar-plan
 */
import { expect, test, type BrowserContext } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const SIDEBAR_COOKIE = "sidebar_state_00000000000040008000000000000001"

async function setup(context: BrowserContext, baseURL: string, plan: "free" | "pro", open = true) {
  await context.addCookies([
    { name: "organizzou_consent", value: CONSENT, url: baseURL },
    { name: "dev_plan", value: plan, url: baseURL },
    { name: SIDEBAR_COOKIE, value: String(open), url: baseURL },
  ])
}

test.beforeEach(async ({ page }) => {
  // Taller than 900 px: on shorter screens the card drops its description by design.
  await page.setViewportSize({ width: 1440, height: 1000 })
})

test("Free, expanded: Configurações follows Organização, no upgrade row, the card sells the Pro plan", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!, "free")
  await page.goto("/dashboard")
  const nav = page.getByRole("navigation", { name: "Módulos" }).first()
  await expect(nav.getByRole("button", { name: "Configurações" })).toBeVisible({ timeout: 30000 })
  const org = (await nav.getByRole("button", { name: "Organização" }).boundingBox())!
  const cfg = (await nav.getByRole("button", { name: "Configurações" }).boundingBox())!
  expect(cfg.y).toBeGreaterThan(org.y)
  expect(cfg.y - org.y).toBeLessThan(60)
  await expect(page.getByText("Desbloqueie o Plano Pro")).toBeVisible()
  await expect(page.getByText("Mais limites no assistente, histórico e gráficos sem teto.")).toBeVisible()
  // The old Lima row is gone: the only "Fazer upgrade" in the sidebar is the card's button.
  await expect(page.locator("[data-sidebar=sidebar]").getByRole("link", { name: "Fazer upgrade" })).toHaveCount(1)
})

test("Pro: no card at the bottom of the sidebar", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!, "pro")
  await page.goto("/dashboard")
  await expect(page.getByRole("button", { name: "Configurações" }).first()).toBeVisible({ timeout: 30000 })
  await expect(page.getByText("Desbloqueie o Plano Pro")).toHaveCount(0)
})

test("Collapsed rail: the gear sits with the module icons, Free sees the upgrade button, the flyout has no WhatsApp entry", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!, "free", false)
  await page.goto("/dashboard")
  const rail = page.locator("[data-sidebar=sidebar]")
  const gear = rail.getByRole("button", { name: "Configurações" })
  await expect(gear).toBeVisible({ timeout: 30000 })
  const org = (await rail.getByRole("button", { name: "Organização" }).boundingBox())!
  const g = (await gear.boundingBox())!
  expect(g.y - org.y).toBeLessThan(70)
  await expect(rail.getByRole("link", { name: "Fazer upgrade" })).toBeVisible()
  await gear.click()
  await expect(page.getByRole("link", { name: "Perfil" })).toBeVisible()
  await expect(page.getByText(/WhatsApp/i)).toHaveCount(0)
})

test("Pro, collapsed: no upgrade button in the rail", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!, "pro", false)
  await page.goto("/dashboard")
  await expect(page.getByRole("button", { name: "Configurações" }).first()).toBeVisible({ timeout: 30000 })
  await expect(page.locator("[data-sidebar=sidebar]").getByRole("link", { name: "Fazer upgrade" })).toHaveCount(0)
})

test("Profile menu: plan badge and a round arrow, no upgrade button inside", async ({ page, context, baseURL }) => {
  for (const plan of ["free", "pro"] as const) {
    await setup(context, baseURL!, plan)
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
