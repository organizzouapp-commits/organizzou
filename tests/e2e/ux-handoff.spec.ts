/**
 * Post-login hand-off: the app must not reach /dashboard before the logo's intro has played, and reduced motion only keeps the
 * logo for ~600 ms. The hand-off is started through a dev-only window hook, because a real sign-in needs Supabase.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test ux-handoff
 */
import { expect, test, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const INTRO_MS = 2600

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
})

async function timeToDashboard(page: Page) {
  await page.goto("/login")
  await page.waitForFunction(() => Boolean((window as unknown as { __startLoadingHandoff?: unknown }).__startLoadingHandoff))
  // Warm the destination so only the hand-off timing is measured.
  await page.request.get("/dashboard").catch(() => {})
  const t0 = Date.now()
  await page.evaluate(() => (window as unknown as { __startLoadingHandoff: (href: string) => void }).__startLoadingHandoff("/dashboard"))
  await expect(page.getByRole("status", { name: "Carregando" })).toBeVisible()
  // The navigation starts at once under the opaque overlay; what the intro protects is how long the logo stays: until it has played AND the shell is ready.
  await expect(page.locator("[data-handoff]")).toHaveCount(0, { timeout: 15000 })
  await page.waitForURL(/\/dashboard$/)
  return Date.now() - t0
}

test("the logo stays until its intro has played, then the dashboard is there", async ({ page }) => {
  const elapsed = await timeToDashboard(page)
  expect(elapsed).toBeGreaterThanOrEqual(INTRO_MS - 100)
  await expect(page.locator("[data-app-scroll]")).toBeVisible()
})

test("reduced motion: keeps the logo for ~600 ms instead of the full intro", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" })
  await ctx.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
  const page = await ctx.newPage()
  const elapsed = await timeToDashboard(page)
  expect(elapsed).toBeGreaterThanOrEqual(500)
  expect(elapsed).toBeLessThan(INTRO_MS)
  await ctx.close()
})
