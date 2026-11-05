/**
 * The e-mail/password hand-off (client navigation) must never leave the splash on screen: it leaves when the dashboard shell says it is ready
 * (splash-store), after the logo's intro, or at the 8 s hard limit; a stalled client navigation falls back to a full page load after 3 s.
 * The hand-off is started through the dev-only window hook (a real sign-in needs Supabase):
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test splash-email-flow
 * With a real test account, on a production build (npm run build && npx next start -p 3210):
 *   E2E_LOGIN_EMAIL=... E2E_LOGIN_PASSWORD=... BASE=http://localhost:3210 npx playwright test splash-email-flow
 */
import { expect, test, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
})

/** A "bare" frame: on the dashboard, nothing covers the wallpaper (no hand-off overlay, no server splash) and the shell has no content yet. Must be 0. */
async function installBareProbe(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __bare: number; __frames: number }
    w.__bare = 0
    w.__frames = 0
    const tick = () => {
      w.__frames += 1
      if (location.pathname.startsWith("/dashboard") && document.body && !document.querySelector("[data-handoff]") && !document.documentElement.hasAttribute("data-splash")) {
        const shell = document.querySelector("[data-app-scroll]")
        if (!shell || (shell.textContent ?? "").trim().length <= 20) w.__bare += 1
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}
const bareFrames = (page: Page) => page.evaluate(() => (window as unknown as { __bare: number }).__bare)

async function start(page: Page) {
  await page.goto("/login")
  await page.waitForFunction(() => Boolean((window as unknown as { __startLoadingHandoff?: unknown }).__startLoadingHandoff))
  const t0 = Date.now()
  await page.evaluate(() => (window as unknown as { __startLoadingHandoff: (href: string) => void }).__startLoadingHandoff("/dashboard"))
  await expect(page.locator("[data-handoff]")).toBeVisible()
  return t0
}

test("the overlay is gone within the hard limit and the dashboard content is there, with no reload and no bare frame", async ({ page }) => {
  await installBareProbe(page)
  const t0 = await start(page)
  await expect(page.locator("[data-handoff]")).toHaveCount(0, { timeout: 9000 })
  expect(Date.now() - t0).toBeLessThan(9000)
  await expect(page.locator("[data-app-scroll]")).toBeVisible()
  expect(new URL(page.url()).pathname).toBe("/dashboard")
  await page.waitForTimeout(500)
  expect(await bareFrames(page)).toBe(0)
})

test("a skeleton that never goes away on the dashboard does not hold the overlay (no DOM probing)", async ({ page }) => {
  await page.addInitScript(() => {
    // What broke the previous version: a skeleton / aria-busy region that stays on screen on the dashboard.
    const add = () => {
      if (!location.pathname.startsWith("/dashboard") || document.querySelector("#stuck-skeleton") || !document.body) return
      const el = document.createElement("div")
      el.id = "stuck-skeleton"
      el.className = "page-skeleton"
      el.setAttribute("aria-busy", "true")
      el.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px"
      document.body.appendChild(el)
    }
    setInterval(add, 50)
  })
  await installBareProbe(page)
  const t0 = await start(page)
  await expect(page.locator("[data-handoff]")).toHaveCount(0, { timeout: 9000 })
  expect(Date.now() - t0).toBeLessThan(9000)
  expect(new URL(page.url()).pathname).toBe("/dashboard")
  expect(await bareFrames(page)).toBe(0)
})

test("a stalled client navigation falls back to a full page load, and the splash is not stuck", async ({ page }) => {
  // The RSC requests of the client navigation never answer; full document requests are untouched.
  await page.route("**/dashboard**", async (route) => {
    if (route.request().headers()["rsc"]) return new Promise(() => {}) // never fulfilled
    return route.continue()
  })
  const t0 = await start(page)
  // ~2.6 s intro + 3 s of a navigation that goes nowhere -> window.location.assign -> the dashboard document.
  await page.waitForURL(/\/dashboard/, { timeout: 12000 })
  await expect(page.locator("[data-app-scroll]")).toBeVisible({ timeout: 12000 })
  await expect(page.locator("[data-handoff]")).toHaveCount(0)
  expect(Date.now() - t0).toBeLessThan(12000)
})

test("production, real e-mail sign-in: the overlay is gone in 8 s and the dashboard is visible without F5", async ({ page }) => {
  const email = process.env.E2E_LOGIN_EMAIL
  const password = process.env.E2E_LOGIN_PASSWORD
  test.skip(!email || !password, "needs E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD (a real test account)")
  test.setTimeout(60000)
  const requests: string[] = []
  page.on("request", (r) => {
    if (/\/auth\/|dashboard|login|_rsc/.test(r.url())) requests.push(`${r.method()} ${new URL(r.url()).pathname}${new URL(r.url()).search.slice(0, 20)}${r.headers()["rsc"] ? " (RSC)" : ""}`)
  })
  await installBareProbe(page)
  await page.goto("/login?splashDebug=1")
  await page.getByLabel("E-mail").fill(email!)
  await page.getByLabel("Senha", { exact: false }).first().fill(password!)
  const t0 = Date.now()
  await page.getByRole("button", { name: /Entrar/ }).first().click()
  await page.waitForURL(/\/dashboard/, { timeout: 30000 })
  await expect(page.locator("[data-handoff]")).toHaveCount(0, { timeout: 9000 })
  // Budget: the intro (2.6 s) and the dashboard in parallel, so content in well under 6 s from the click on a local production build.
  await expect(page.locator("[data-app-scroll]")).toBeVisible()
  expect(Date.now() - t0).toBeLessThan(6000)
  expect(await bareFrames(page)).toBe(0)
  console.log("TRACE", requests.join(" | "))
  console.log("SPLASHLOG", JSON.stringify(await page.evaluate(() => JSON.parse(sessionStorage.getItem("splashLog") ?? "[]"))))
})
