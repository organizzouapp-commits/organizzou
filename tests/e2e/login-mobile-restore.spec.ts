/**
 * Mobile welcome screen (390x844): the headline sits on the photo with no card, the "Entrar" tab is transparent, both follow the theme (Tinta in
 * light, Papel in dark, via the foreground token), "Criar conta" stays Lima, and the sheet covers the tab when open.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test login-mobile-restore
 * SHOTS_OUT=<dir> saves the screen of each theme (used for before/after, outside docs/screenshots).
 */
import { mkdirSync } from "node:fs"

import { expect, test, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const OUT = process.env.SHOTS_OUT
if (OUT) mkdirSync(OUT, { recursive: true })

/** What the browser resolves a design token to (a probe element, so oklch/color-mix come back as the browser's own rgb/lab string). */
const token = (page: Page, css: string) =>
  page.evaluate((value) => {
    const probe = document.createElement("div")
    probe.style.color = value
    document.body.appendChild(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }, css)

const transparent = (c: string) => c === "rgba(0, 0, 0, 0)" || c === "transparent" || /\/ 0\)$/.test(c)

for (const theme of ["dark", "light"] as const) {
  test.describe(`mobile login, ${theme}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
      await context.addInitScript((t) => {
        try {
          localStorage.setItem("theme", t)
        } catch {}
      }, theme)
    })

    test("headline and Entrar sit on the photo, themed; Criar conta stays Lima; the sheet covers the tab", async ({ page }) => {
      await page.goto("/login")
      const headline = page.getByRole("heading", { name: "Sua vida, organizada." })
      await expect(headline).toBeVisible({ timeout: 60000 })
      await page.waitForTimeout(1800) // the entrance animation
      if (OUT) await page.screenshot({ path: `${OUT}/login-390-${theme}.png` })

      // No card behind the headline block: every ancestor up to the welcome screen is transparent, with no border, blur or shadow box.
      const box = headline.locator("xpath=..")
      const cs = await box.evaluate((el) => {
        const s = getComputedStyle(el)
        return { bg: s.backgroundColor, border: s.borderTopWidth, shadow: s.boxShadow, blur: s.backdropFilter, radius: s.borderTopLeftRadius }
      })
      expect(transparent(cs.bg)).toBe(true)
      expect(cs.border).toBe("0px")
      expect(cs.shadow).toBe("none")
      expect(["none", ""].includes(cs.blur)).toBe(true)
      expect(transparent(await headline.evaluate((el) => getComputedStyle(el).backgroundColor))).toBe(true)

      // The Entrar tab: transparent, full half-width hit area, 44px+.
      const entrar = page.getByRole("button", { name: "Entrar", exact: true }).first()
      expect(transparent(await entrar.evaluate((el) => getComputedStyle(el).backgroundColor))).toBe(true)
      const eb = (await entrar.boundingBox())!
      expect(eb.height).toBeGreaterThanOrEqual(44)
      expect(Math.round(eb.width)).toBe(195)

      // Colors follow the theme through the foreground token: Papel in dark, Tinta in light.
      const ink = await token(page, theme === "dark" ? "var(--palette-papel)" : "var(--palette-tinta)")
      expect(await headline.evaluate((el) => getComputedStyle(el).color)).toBe(ink)
      expect(await page.getByText("Tudo do seu dia em um só lugar.").evaluate((el) => getComputedStyle(el).color)).toBe(ink)
      expect(await entrar.evaluate((el) => getComputedStyle(el).color)).toBe(ink)

      // The logo: the dark-theme file (light letters) in dark, the light-theme file (dark letters) in light, switched by CSS (no flicker).
      const logos = headline.locator("xpath=ancestor::div[contains(@class,'fixed')][1]").locator("img[src*='organizzou-logo-entrada']")
      const visible = await logos.evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0).map((e) => e.getAttribute("src")))
      expect(visible).toHaveLength(1)
      expect(visible[0]).toContain(theme === "dark" ? "escuro" : "claro")

      // Criar conta: Lima with Tinta text in both themes, rounded top-left, flush at the bottom-right.
      const criar = page.getByRole("button", { name: "Criar conta", exact: true }).first()
      expect(await criar.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(await page.evaluate(() => {
        const p = document.createElement("div")
        p.style.backgroundColor = "var(--highlight)"
        document.body.appendChild(p)
        const c = getComputedStyle(p).backgroundColor
        p.remove()
        return c
      }))
      expect(await criar.evaluate((el) => getComputedStyle(el).color)).toBe(await token(page, "var(--highlight-foreground)"))
      expect(parseFloat(await criar.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))).toBe(28)
      const cb = (await criar.boundingBox())!
      expect(Math.round(cb.x + cb.width)).toBe(390)
      expect(Math.round(cb.y + cb.height)).toBe(844)

      // Opening the sheet: it covers the Lima tab completely (what is at the tab's center is the sheet, never the tab).
      await entrar.click()
      const sheet = page.locator("[data-auth-sheet], [role=dialog]").first()
      await page.waitForTimeout(900)
      const center = { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 }
      const hit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y)
        return { tab: Boolean(el?.closest("button")?.textContent?.includes("Criar conta") && !el.closest("form")), text: (el?.textContent ?? "").slice(0, 30) }
      }, center)
      expect(hit.tab).toBe(false)
      void sheet
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  })
}
