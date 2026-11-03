/**
 * Follow-up fixes: the Pro assistant card is Lima, the phone FAB is Pro-only, Configurações is reachable on phones, and the
 * Destaques / Seu dia / Precisa de você headers share one rhythm.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test hoje-followup
 */
import { expect, test, type BrowserContext } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const SIDEBAR_COOKIE = "sidebar_state_00000000000040008000000000000001"

async function setup(context: BrowserContext, baseURL: string, plan: "free" | "pro", sidebarOpen = true) {
  await context.addCookies([
    { name: "organizzou_consent", value: CONSENT, url: baseURL },
    { name: "dev_plan", value: plan, url: baseURL },
    { name: SIDEBAR_COOKIE, value: String(sidebarOpen), url: baseURL },
  ])
}

test.describe("sidebar assistant card", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`Pro: the card is Lima with Tinta text (${theme}); Free keeps the upgrade card`, async ({ page, context, baseURL }) => {
      await setup(context, baseURL!, "pro")
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto("/dashboard")
      const card = page.getByTestId("assistant-card")
      await expect(card).toBeVisible({ timeout: 60000 })
      const probe = await page.evaluate(() => {
        const lima = document.createElement("div")
        lima.className = "bg-highlight text-highlight-foreground"
        document.body.append(lima)
        const s = getComputedStyle(lima)
        const out = { bg: s.backgroundColor, fg: s.color }
        lima.remove()
        return out
      })
      await expect(card).toHaveCSS("background-color", probe.bg)
      await expect(card).toHaveCSS("color", probe.fg)
      await expect(card).toHaveCSS("border-radius", "16px")
      await expect(card.locator("span").first()).toHaveCSS("width", "40px")
      await context.addCookies([{ name: "dev_plan", value: "free", url: baseURL! }])
      await page.reload()
      await expect(page.getByText("Desbloqueie o Plano Pro")).toBeVisible({ timeout: 60000 })
      await expect(page.getByTestId("assistant-card")).toHaveCount(0)
    })
  }
})

test.describe("phone floating button", () => {
  test("Pro: a 56 px circle at the bottom right, opens the assistant, hides while it is open, never covers the last card", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, "pro")
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/dashboard")
    const fab = page.getByRole("button", { name: "Abrir assistente virtual" })
    await expect(fab).toBeVisible({ timeout: 60000 })
    const box = (await fab.boundingBox())!
    expect(Math.round(box.width)).toBe(56)
    expect(Math.round(box.height)).toBe(56)
    expect(Math.round(390 - (box.x + box.width))).toBe(16)
    expect(Math.round(844 - (box.y + box.height))).toBeGreaterThanOrEqual(16)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const lastBottom = await page.evaluate(() => {
      const els = [...document.querySelectorAll("[data-module-card]")]
      return els.length ? els[els.length - 1].getBoundingClientRect().bottom : null
    })
    if (lastBottom !== null) expect(lastBottom).toBeLessThanOrEqual((await fab.boundingBox())!.y)
    await fab.click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(fab).toHaveCount(0)
  })

  test("Free: no floating button on phones; Pro: none on desktop", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, "free")
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/dashboard")
    await expect(page.getByRole("link", { name: "Hoje" }).first()).toBeVisible({ timeout: 60000 })
    await expect(page.getByTestId("assistant-fab")).toHaveCount(0)
    await context.addCookies([{ name: "dev_plan", value: "pro", url: baseURL! }])
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.reload()
    await expect(page.getByTestId("assistant-card")).toBeVisible({ timeout: 60000 })
    await expect(page.getByTestId("assistant-fab")).toBeHidden()
  })
})

test.describe("Configurações on phones", () => {
  test("the header chip opens the account entries (44 px), the Outros sheet lists them, and the route marks it active", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, "free")
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/dashboard/configuracoes")
    const chip = page.getByRole("navigation", { name: "Módulos" }).getByRole("button", { name: "Configurações" })
    await expect(chip).toBeVisible({ timeout: 60000 })
    await expect(chip).toHaveAttribute("data-active", "")
    await chip.click()
    for (const name of ["Perfil", "Configurações", "Ajuda", "Plano e cobrança", "Sair"]) {
      const item = page.getByRole("menuitem", { name })
      await expect(item).toBeVisible()
      expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(43.5)
    }
    await page.keyboard.press("Escape")
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button").last().click()
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByText("Configurações", { exact: true }).first()).toBeVisible()
    for (const name of ["Perfil", "Ajuda", "Plano e cobrança"]) await expect(sheet.getByRole("link", { name })).toBeVisible()
  })

  test("the collapsed rail keeps its settings icon with a tooltip", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, "free", false)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/dashboard")
    const gear = page.locator("[data-sidebar=sidebar]").getByRole("button", { name: "Configurações" })
    await expect(gear).toBeVisible({ timeout: 60000 })
    await gear.hover()
    await expect(page.getByRole("tooltip").getByText("Configurações")).toBeVisible()
  })
})

test.describe("section headers", () => {
  test("DESTAQUES: the gap under the header row is 12 px and the row is at most 36 px", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, "free")
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto("/dashboard")
    const section = page.locator('section[aria-label="Destaques"]').first()
    await expect(section).toBeVisible({ timeout: 60000 })
    const header = (await section.locator("> div").first().boundingBox())!
    const content = (await section.locator("> div:visible").nth(1).boundingBox())!
    expect(Math.round(header.height)).toBeLessThanOrEqual(36)
    expect(Math.round(content.y - (header.y + header.height))).toBe(12)
    await expect(page.getByRole("heading", { name: "Seu dia" })).toHaveCSS("text-transform", "uppercase")
  })
})
