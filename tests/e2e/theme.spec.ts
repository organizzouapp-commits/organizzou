/**
 * The theme: Claro / Escuro / Sistema from both controls (header switch and Perfil > Aparência), kept after a reload, saved on the
 * profile so another device gets it, and no flash on load. Real session on the demo account (server WITHOUT the login bypass):
 *   E2E_DEMO_SESSION=1 npx playwright test theme
 * The demo profile is put back to dark at the end.
 */
import { expect, test, type Page } from "@playwright/test"

import { demoSessionCookies } from "./helpers/demo-session"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const SIDEBAR_COOKIE = "sidebar_state_00000000000040008000000000000001"

test.skip(!process.env.E2E_DEMO_SESSION, "needs E2E_DEMO_SESSION=1 and the real-auth server")
test.describe.configure({ mode: "serial" })

const isLight = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("light") && !document.documentElement.classList.contains("dark"))
const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"))

/** The computed page background, as the browser paints it: the class alone is not proof, the light tokens must really apply. */
const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

async function open(page: Page, path: string) {
  await page.goto(path)
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }, ...(await demoSessionCookies("organizzouapp@gmail.com", baseURL!))])
})

test.use({ viewport: { width: 1440, height: 900 } })

test("header switch: dark -> light -> dark, and the choice survives a reload", async ({ page }) => {
  await open(page, "/dashboard")
  const toggle = page.getByRole("button", { name: "Alternar entre tema claro e escuro" }).first()
  if (await isLight(page)) await toggle.click()
  await expect.poll(() => isDark(page)).toBe(true)
  await toggle.click()
  await expect.poll(() => isLight(page)).toBe(true)
  const lightBg = await bodyBackground(page)
  await page.waitForTimeout(1500)
  await page.reload()
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
  expect(await isLight(page)).toBe(true)
  expect(await bodyBackground(page)).toBe(lightBg)
  await page.getByRole("button", { name: "Alternar entre tema claro e escuro" }).first().click()
  await expect.poll(() => isDark(page)).toBe(true)
  await expect.poll(() => bodyBackground(page)).not.toBe(lightBg)
  await page.reload()
  expect(await isDark(page)).toBe(true)
})

test("Perfil > Aparência: Claro, Escuro and Sistema; saved on the profile (a fresh device gets it)", async ({ page, browser, baseURL }) => {
  await open(page, "/dashboard/configuracoes?aba=aparencia")
  await page.getByRole("radio", { name: "Claro" }).click()
  await expect.poll(() => isLight(page)).toBe(true)
  await expect(page.getByRole("radio", { name: "Claro" })).toBeChecked()
  // Wait for the save, then open the app in a brand-new context (no localStorage): the profile decides.
  await page.waitForTimeout(1500)
  const other = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await other.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }, { name: SIDEBAR_COOKIE, value: "true", url: baseURL! }, ...(await demoSessionCookies("organizzouapp@gmail.com", baseURL!))])
  const fresh = await other.newPage()
  await fresh.goto("/dashboard")
  await expect.poll(() => isLight(fresh)).toBe(true)
  await other.close()

  await page.getByRole("radio", { name: "Sistema" }).click()
  await expect(page.getByRole("radio", { name: "Sistema" })).toBeChecked()
  await page.reload()
  await expect(page.getByRole("radio", { name: "Sistema" })).toBeChecked()
  await page.getByRole("radio", { name: "Escuro" }).click()
  await expect.poll(() => isDark(page)).toBe(true)
  await page.waitForTimeout(1500)
  await page.reload()
  expect(await isDark(page)).toBe(true)
})

test("light mode: main screens have no unreadable text (light text on a light surface)", async ({ page }) => {
  await open(page, "/dashboard")
  if (await isDark(page)) await page.getByRole("button", { name: "Alternar entre tema claro e escuro" }).first().click()
  await expect.poll(() => isLight(page)).toBe(true)
  await page.waitForTimeout(1500) // let the profile save finish before navigating
  for (const path of ["/dashboard", "/dashboard/tarefas", "/dashboard/agenda", "/dashboard/rotina", "/dashboard/financas", "/dashboard/treinos", "/dashboard/dieta", "/dashboard/estudos", "/dashboard/notas", "/dashboard/metas", "/dashboard/diario", "/dashboard/configuracoes", "/dashboard/plano"]) {
    await open(page, path)
    await page.waitForLoadState("load")
    await page.waitForTimeout(700) // colors ease for 400ms; measure after
    const weak = await page.evaluate(() => {
      const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!
      const lum = (c: string) => {
        // Computed colors can come back as lab()/oklch(): a 1px canvas turns any of them into plain RGBA.
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = "#000"
        ctx.fillStyle = c
        ctx.fillRect(0, 0, 1, 1)
        const px = ctx.getImageData(0, 0, 1, 1).data
        const m = [px[0], px[1], px[2], px[3] / 255]
        const [r, g, b] = m.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
        return { l: 0.2126 * r + 0.7152 * g + 0.0722 * b, a: m[3] ?? 1 }
      }
      // Glass surfaces are translucent over a picture: only text on an opaque surface can be measured.
      const bgOf = (el: Element | null): number | null => {
        for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) { const { l, a } = lum(getComputedStyle(e).backgroundColor); if (a > 0.5) return l }
        return null
      }
      const bad: string[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n && bad.length < 8; n = walker.nextNode()) {
        const text = n.textContent?.trim()
        const el = n.parentElement
        if (!text || !el || el.closest("script,style,[hidden],[aria-hidden=true]")) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const fg = lum(getComputedStyle(el).color).l
        const bg = bgOf(el)
        if (bg === null) continue
        const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
        if (ratio < 2.2) bad.push(`${text.slice(0, 30)} (${ratio.toFixed(1)})`)
      }
      return bad
    })
    expect(weak, path).toEqual([])
  }
})

test.afterAll(async ({ browser, baseURL }) => {
  const context = await browser.newContext()
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }, ...(await demoSessionCookies("organizzouapp@gmail.com", baseURL!))])
  const page = await context.newPage()
  await page.goto("/dashboard/configuracoes?aba=aparencia")
  await page.getByRole("radio", { name: "Escuro" }).click()
  await page.waitForTimeout(1500)
  await context.close()
})
