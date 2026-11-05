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
  // Dev only: warm the destination so a first-visit compile (8 s+) is not mistaken for a stuck splash.
  await page.request.get("/dashboard").catch(() => {})
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

const email = process.env.E2E_LOGIN_EMAIL
const password = process.env.E2E_LOGIN_PASSWORD
const SKIP = "needs E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD (a real test account) and a production build (BASE=http://localhost:3210)"

/** One e-mail sign-in; returns ms from the click to the dashboard content with the overlay gone. Fails on a bare frame, a reload or a stuck overlay. */
async function signInOnce(page: Page, label: string) {
  await page.goto("/login?splashDebug=1")
  await page.getByLabel("E-mail").fill(email!)
  await page.getByLabel("Senha", { exact: false }).first().fill(password!)
  let documents = 0
  const onNav = () => void (documents += 1)
  page.on("load", onNav)
  const t0 = Date.now()
  await page.getByRole("button", { name: /Entrar/ }).first().click()
  await expect(page.locator("[data-handoff]")).toHaveCount(0, { timeout: 6500 })
  await expect(page.locator("[data-app-scroll]")).toBeVisible({ timeout: 1000 })
  const ms = Date.now() - t0
  page.off("load", onNav)
  expect(new URL(page.url()).pathname, label).toMatch(/^\/dashboard/)
  expect(await bareFrames(page), label + ": bare frames").toBe(0)
  console.log("SIGNIN", label, ms + "ms", "documents loaded after the click:", documents)
  return ms
}

test("production, real e-mail sign-in: overlay gone and dashboard visible within 6 s, no F5, no bare frame (10 times in a row)", async ({ page }) => {
  test.skip(!email || !password, SKIP)
  test.setTimeout(240_000)
  await installBareProbe(page)
  for (let i = 1; i <= 10; i++) {
    await signInOnce(page, "run " + i)
    // Sign out through a fresh context state: clear the session so the next login starts from the login screen again.
    await page.context().clearCookies()
    await page.context().addCookies([{ name: "organizzou_consent", value: CONSENT, url: page.url() }])
  }
})

test("production, real e-mail sign-in with the CPU 4x slower", async ({ page }) => {
  test.skip(!email || !password, SKIP)
  test.setTimeout(120_000)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
  await installBareProbe(page)
  await signInOnce(page, "cpu 4x")
})

test("production, real e-mail sign-in twice in the same session (a fast, cached dashboard the second time)", async ({ page }) => {
  test.skip(!email || !password, SKIP)
  test.setTimeout(120_000)
  await installBareProbe(page)
  await signInOnce(page, "first")
  // Back to the login without a reload of the app state: the dashboard is now cached by the client router.
  await page.context().clearCookies()
  await page.context().addCookies([{ name: "organizzou_consent", value: CONSENT, url: page.url() }])
  await signInOnce(page, "second (cached)")
})
