/**
 * Mobile welcome screen (390x844): the headline panel and the "Entrar" tab are the same frosted glass as the desktop card (.auth-glass: the
 * pre-blurred copy of the photo, the theme's tint, a 1 px border), translucent, with text and logo following the theme (Tinta in light, Papel in
 * dark, via the foreground token). "Criar conta" stays Lima and the sheet covers the tab when open.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test login-mobile-restore
 * SHOTS_OUT=<dir> saves the screen of each theme (used for before/after, outside docs/screenshots).
 */
import { mkdirSync, writeFileSync } from "node:fs"

import { expect, test, type Locator, type Page } from "@playwright/test"
import sharp from "sharp"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const OUT = process.env.SHOTS_OUT
if (OUT) mkdirSync(OUT, { recursive: true })

/** What the browser resolves a design token to (a probe element, so oklch/color-mix come back as the browser's own string). */
const resolve = (page: Page, prop: "color" | "backgroundColor", css: string) =>
  page.evaluate(
    ([p, value]) => {
      const probe = document.createElement("div")
      probe.style[p as "color"] = value
      document.body.appendChild(probe)
      const color = getComputedStyle(probe)[p as "color"]
      probe.remove()
      return color
    },
    [prop, css] as const
  )

const luminance = (r: number, g: number, b: number) => {
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/**
 * The worst contrast the text can meet on this glass: the element is screenshotted with its text made invisible, and the text color is compared
 * with the brightest (for light text) or darkest (for dark text) 1% of the pixels behind it.
 */
async function worstContrast(page: Page, panel: Locator, textRgb: [number, number, number], lightText: boolean, inset = 28) {
  await panel.evaluate((el) => el.setAttribute("data-measuring", ""))
  await page.addStyleTag({ content: "[data-measuring], [data-measuring] * { color: transparent !important; text-shadow: none !important } nextjs-portal { display: none !important }" })
  // The rounded corners show the photo behind the panel, not the glass: measure the middle (inset by the radius).
  const box = (await panel.boundingBox())!
  const shot = await page.screenshot({ animations: "disabled", clip: { x: box.x + inset, y: box.y + inset / 2, width: box.width - inset * 2, height: box.height - inset } })
  await panel.evaluate((el) => el.removeAttribute("data-measuring"))
  if (OUT) writeFileSync(`${OUT}/measure-${lightText ? "dark" : "light"}-${Math.round(box.width)}x${Math.round(box.height)}.png`, shot)
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true })
  const lums: number[] = []
  for (let i = 0; i < data.length; i += info.channels) lums.push(luminance(data[i], data[i + 1], data[i + 2]))
  lums.sort((a, b) => a - b)
  const bg = lightText ? lums[Math.floor(lums.length * 0.99)] : lums[Math.floor(lums.length * 0.01)]
  const text = luminance(...textRgb)
  const [hi, lo] = text > bg ? [text, bg] : [bg, text]
  return (hi + 0.05) / (lo + 0.05)
}

/** Any CSS color (oklch, lab, color-mix results...) as sRGB bytes, through a canvas pixel. */
const rgbOf = (page: Page, color: string) =>
  page.evaluate((c) => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!
    ctx.fillStyle = c
    ctx.fillRect(0, 0, 1, 1)
    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)) as [number, number, number]
  }, color)

for (const theme of ["dark", "light"] as const) {
  test.describe(`mobile login glass, ${theme}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
      await context.addInitScript((t) => {
        try {
          localStorage.setItem("theme", t)
        } catch {}
      }, theme)
    })

    test("headline panel and Entrar tab are frosted glass; text follows the theme; Criar conta stays Lima; the sheet covers the tab", async ({ page }) => {
      await page.goto("/login")
      const headline = page.getByRole("heading", { name: "Sua vida, organizada." })
      await expect(headline).toBeVisible({ timeout: 60000 })
      await page.waitForTimeout(2200) // the entrance animation and the glass settling over the photo
      if (OUT) await page.screenshot({ path: `${OUT}/login-390-${theme}.png` })

      const panel = headline.locator("xpath=..")
      const entrar = page.getByRole("button", { name: "Entrar", exact: true }).first()

      for (const [name, glass] of [["headline panel", panel], ["Entrar tab", entrar]] as const) {
        // Translucent tint (never opaque), the shared glass border and the frosted copy of the photo behind it.
        const tint = await glass.locator(".auth-glass-tint").evaluate((el) => getComputedStyle(el).backgroundColor)
        const alpha = tint.match(/\/\s*([\d.]+)%?\)/) ?? tint.match(/rgba?\([^)]*,\s*([\d.]+)\)/)
        const a = alpha ? (tint.includes("%") ? parseFloat(alpha[1]) / 100 : parseFloat(alpha[1])) : 1
        expect(a, `${name} tint ${tint}`).toBeGreaterThan(0.05)
        expect(a, `${name} tint ${tint}`).toBeLessThan(0.7)
        expect(await glass.evaluate((el) => getComputedStyle(el, "::after").borderTopWidth)).toBe("1px")
        expect(await glass.evaluate((el) => el.classList.contains("auth-glass"))).toBe(true)
        const frost = glass.locator("picture img")
        await expect(frost).toBeAttached()
        expect(await frost.evaluate((el) => (el as HTMLImageElement).currentSrc)).toContain("auth-panel-frost-mobile.webp")
        // One blur layer, baked into the image: no runtime backdrop-filter anywhere in the panel.
        expect(await glass.evaluate((el) => [el, ...Array.from(el.querySelectorAll("*"))].some((e) => { const f = getComputedStyle(e).backdropFilter; return Boolean(f) && f !== "none" }))).toBe(false)
      }
      expect(parseFloat(await panel.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))).toBe(28)
      const eb = (await entrar.boundingBox())!
      expect(eb.height).toBeGreaterThanOrEqual(44)
      expect(Math.round(eb.width)).toBe(195)

      // Text and logo follow the theme through the foreground token: Papel in dark, Tinta in light.
      const ink = await resolve(page, "color", theme === "dark" ? "var(--palette-papel)" : "var(--palette-tinta)")
      expect(await headline.evaluate((el) => getComputedStyle(el).color)).toBe(ink)
      expect(await page.getByText("Tudo do seu dia em um só lugar.").evaluate((el) => getComputedStyle(el).color)).toBe(ink)
      expect(await entrar.evaluate((el) => getComputedStyle(el).color)).toBe(ink)
      const logos = headline.locator("xpath=ancestor::div[contains(@class,'fixed')][1]").locator("img[src*='organizzou-logo-entrada']")
      const visible = await logos.evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0).map((e) => e.getAttribute("src")))
      expect(visible).toHaveLength(1)
      expect(visible[0]).toContain(theme === "dark" ? "escuro" : "claro")

      // Contrast on the worst pixels behind the text: >= 4.5:1.
      const lightText = theme === "dark"
      expect(await worstContrast(page, panel, await rgbOf(page, ink), lightText), "headline panel").toBeGreaterThanOrEqual(4.5)
      expect(await worstContrast(page, entrar, await rgbOf(page, ink), lightText, 14), "Entrar tab").toBeGreaterThanOrEqual(4.5)

      // Criar conta: Lima with Tinta text in both themes, rounded top-left, flush at the bottom-right.
      const criar = page.getByRole("button", { name: "Criar conta", exact: true }).first()
      expect(await criar.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(await resolve(page, "backgroundColor", "var(--highlight)"))
      expect(await criar.evaluate((el) => getComputedStyle(el).color)).toBe(await resolve(page, "color", "var(--highlight-foreground)"))
      expect(parseFloat(await criar.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))).toBe(28)
      const cb = (await criar.boundingBox())!
      expect(Math.round(cb.x + cb.width)).toBe(390)
      expect(Math.round(cb.y + cb.height)).toBe(844)

      // Opening the sheet: what is at the Lima tab's center is the sheet, never the tab.
      await entrar.click()
      await page.waitForTimeout(900)
      const hit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y)
        return Boolean(el?.closest("button")?.textContent?.includes("Criar conta") && !el.closest("form"))
      }, { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 })
      expect(hit).toBe(false)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  })
}

test.describe("reduced transparency", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test("an opaque panel with no frosted copy of the photo", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
    await ctx.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
    const page = await ctx.newPage()
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.goto("/login")
    const headline = page.getByRole("heading", { name: "Sua vida, organizada." })
    await expect(headline).toBeVisible({ timeout: 60000 })
    // Chromium has no emulation switch for prefers-reduced-transparency here: assert the rules exist in the shipped CSS instead.
    const css = await page.evaluate(() => Array.from(document.styleSheets).flatMap((s) => { try { return Array.from(s.cssRules).map((r) => r.cssText) } catch { return [] } }).join("\n"))
    const rules = css.split("@media").filter((r) => r.includes("prefers-reduced-transparency"))
    expect(rules.length).toBeGreaterThan(0)
    // Inside it: the glass panel loses its frosted picture and its tint becomes the opaque background.
    expect(rules.join("\n")).toMatch(/auth-glass[^{}]*picture[^{}]*\{[^}]*display:\s*none/)
    expect(rules.join("\n")).toContain("--auth-glass-bg: var(--background)")
    await ctx.close()
  })
})
