/**
 * Collapsed layout: the "Configurações" dropdown in the top header.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test ux-header-configuracoes
 */
import { expect, test, type BrowserContext } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const SIDEBAR_COOKIE = "sidebar_state_00000000000040008000000000000001"

async function setup(context: BrowserContext, baseURL: string, plan: "free" | "pro") {
  await context.addCookies([
    { name: "organizzou_consent", value: CONSENT, url: baseURL },
    { name: "dev_plan", value: plan, url: baseURL },
    { name: "dev_whatsapp", value: "0", url: baseURL },
    { name: SIDEBAR_COOKIE, value: "false", url: baseURL },
  ])
}

for (const width of [1440, 1100]) {
  test(`Free, ${width}px: Configurações is the last pill, opens one dropdown at a time, WhatsApp is locked`, async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, "free")
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/dashboard")
    const header = page.locator("header").filter({ has: page.getByRole("navigation", { name: "Módulos" }) })
    const nav = header.getByRole("navigation", { name: "Módulos" })
    const pills = nav.getByRole("button")
    await expect(pills.last()).toHaveAccessibleName("Configurações", { timeout: 30000 })
    expect(await pills.allTextContents()).toEqual(expect.arrayContaining(["Vida", "Organização"]))

    // The header never overflows horizontally.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await pills.last().click()
    for (const name of ["Perfil", "Configurações", "Ajuda", "Plano e cobrança"]) await expect(page.getByRole("menuitem", { name })).toBeVisible()
    const whatsapp = page.getByRole("menuitem", { name: /Conectar WhatsApp/ })
    await expect(whatsapp).toContainText("Plano Pro")
    await expect(whatsapp).toHaveAttribute("href", "/dashboard/plano")
    await expect(page.getByRole("menuitem", { name: "Sair" })).toBeVisible()

    // Only one dropdown at a time: the open menu is modal, so another pill opens only after it closes.
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menu")).toHaveCount(0)
    await nav.getByRole("button", { name: "Vida" }).click()
    await expect(page.getByRole("menu")).toHaveCount(1)
    await expect(page.getByRole("menuitem", { name: "Rotina" })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "Plano e cobrança" })).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menu")).toHaveCount(0)
  })
}

test("Pro: WhatsApp entry leads to the settings tab; Sair asks for confirmation; active state on /dashboard/configuracoes", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!, "pro")
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard/configuracoes")
  const nav = page.getByRole("navigation", { name: "Módulos" }).first()
  const pill = nav.getByRole("button", { name: "Configurações" })
  await expect(pill).toBeVisible({ timeout: 30000 })
  await expect(pill).toHaveClass(/bg-highlight/)
  await expect(nav.getByRole("button", { name: "Vida" })).not.toHaveClass(/bg-highlight/)
  await pill.click()
  const whatsapp = page.getByRole("menuitem", { name: /Conectar WhatsApp/ })
  await expect(whatsapp).toHaveAttribute("href", "/dashboard/configuracoes?aba=whatsapp")
  await expect(whatsapp).not.toContainText("Plano Pro")
  await page.getByRole("menuitem", { name: "Sair" }).click()
  await expect(page.getByRole("alertdialog")).toBeVisible()
  await page.getByRole("button", { name: "Cancelar" }).click()
})

test("the plan icon is the money icon everywhere and the assistant keeps Sparkles", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!, "free")
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard/plano")
  await expect(page.locator("svg.lucide-badge-dollar-sign").first()).toBeVisible({ timeout: 30000 })
  await expect(page.locator('a[href="/dashboard/plano"] svg.lucide-sparkles, button svg.lucide-sparkles + :text("Fazer upgrade")')).toHaveCount(0)
  await page.goto("/dashboard")
  await expect(page.locator("svg.lucide-sparkles").first()).toBeVisible()
})
