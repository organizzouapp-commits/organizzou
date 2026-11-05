/**
 * The post-login splash across FULL page loads (the Google chain: /login -> Google -> /auth/callback -> /dashboard). Each document must continue the
 * same splash, never start another one and never show the wallpaper alone. The chain is simulated with the cookies the real one writes
 * (org_splash before leaving for Google, org_splash_ret from /auth/callback) and hard navigations, on the dev server with the login bypass:
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test splash-resume
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function cookies(context: BrowserContext, baseURL: string, start: number | null, ret: number | null = null) {
  const url = baseURL
  const list = [{ name: "organizzou_consent", value: CONSENT, url }]
  if (start !== null) list.push({ name: "org_splash", value: String(start), url })
  if (ret !== null) list.push({ name: "org_splash_ret", value: String(ret), url })
  await context.addCookies(list)
}

type Sample = { frames: number; bare: number; many: number; firstShown: boolean | null; firstElapsed: number | null; firstAnim: number | null; removedAt: number | null }

/** Samples every frame from the very first one: is the splash on screen, is it the only one, is the page bare (wallpaper without splash or content)? */
async function installProbe(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __s: Sample }
    w.__s = { frames: 0, bare: 0, many: 0, firstShown: null, firstElapsed: null, firstAnim: null, removedAt: null }
    const t0 = performance.now()
    const shown = (el: Element) => {
      const cs = getComputedStyle(el)
      return cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0
    }
    const tick = () => {
      const root = document.documentElement
      const splash = document.getElementById("org-splash")
      const on = Boolean(splash && shown(splash))
      w.__s.frames += 1
      // Frames before the splash element has been parsed belong to the previous document: the first one that can show it is what counts.
      if (!splash) return void requestAnimationFrame(tick)
      if (w.__s.firstShown === null) {
        w.__s.firstShown = on
        w.__s.firstElapsed = parseFloat(getComputedStyle(root).getPropertyValue("--splash-elapsed")) || 0
        const anims = splash?.getAnimations({ subtree: true }) ?? []
        // The local time of the effects (a negative delay puts it ahead of the clock): how far into the intro the animation already is.
        w.__s.firstAnim = anims.length ? Math.max(...anims.map((a) => Number(a.effect?.getComputedTiming().localTime ?? 0) - Number(a.effect?.getTiming().delay ?? 0))) : -1
      }
      if (root.hasAttribute("data-splash") === false && w.__s.removedAt === null && w.__s.firstShown) w.__s.removedAt = performance.now() - t0
      // Loaders on screen: the splash plus any route loading state that is not hidden. Never two.
      const visible = Array.from(document.querySelectorAll("[role=status][aria-label=Carregando]")).filter((e) => e.querySelector(".org-splash-logo, img[src*=logo]")).filter(shown).length
      if (visible > 1 && w.__s.many < 3) (w.__s as unknown as { who: string[] }).who = [...((w.__s as unknown as { who?: string[] }).who ?? []), Array.from(document.querySelectorAll("[role=status][aria-label=Carregando]")).filter(shown).map((e) => e.id + "." + e.className.toString().slice(0, 40) + (e.hasAttribute("data-fallback-splash") ? "[fb]" : "")).join(" | ")]
      if (visible > 1) w.__s.many += 1
      // Bare: on the dashboard, no splash on screen and the shell has no content yet (only the wallpaper is there).
      const onDashboard = location.pathname.startsWith("/dashboard")
      if (onDashboard && !on) {
        const shell = document.querySelector("[data-app-scroll]")
        if (!shell || (shell.textContent ?? "").trim().length <= 20) w.__s.bare += 1
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

const sample = (page: Page) => page.evaluate(() => (window as unknown as { __s: Sample }).__s)

test.describe("a document that continues a login", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("is in the server HTML and starts ON SCREEN, resumed in the middle of the intro (not at its start)", async ({ page, context, baseURL }) => {
    // The clock of the document is pinned: the login started exactly 700 ms before it begins, whatever the dev server takes to answer.
    const start = Date.now()
    await cookies(context, baseURL!, start)
    await page.addInitScript((now) => {
      Date.now = () => now
    }, start + 700)
    await installProbe(page)
    // The splash markup and the boot script are in the HTML the server sends, not added by hydration.
    const html = await (await page.request.get("/dashboard", { headers: { cookie: `org_splash=${Date.now() - 700}` } })).text()
    expect(html).toContain('id="org-splash"')
    expect(html).toContain("splash-boot")
    await page.goto("/dashboard", { waitUntil: "commit" })
    await page.waitForFunction(() => (window as unknown as { __s: Sample }).__s?.firstShown !== null)
    const s = await sample(page)
    expect(s.firstShown).toBe(true)
    // About 0.7 s of the intro had already played when this document began: elapsed is not 0 and the animation clock is past its start.
    expect(s.firstElapsed!).toBeCloseTo(0.7, 1)
    expect(s.firstAnim!).toBeGreaterThanOrEqual(600)
    expect(s.firstAnim!).toBeLessThan(2600)
    await expect(page.locator("html")).not.toHaveAttribute("data-splash-final", "1")
  })

  test("after the intro it is the static final logo (no running animation), still before the first paint", async ({ page, context, baseURL }) => {
    await cookies(context, baseURL!, Date.now() - 9000, Date.now() - 600)
    await installProbe(page)
    await page.goto("/dashboard", { waitUntil: "commit" })
    await page.waitForFunction(() => (window as unknown as { __s: Sample }).__s?.firstShown !== null)
    const s = await sample(page)
    expect(s.firstShown).toBe(true)
    expect(s.firstElapsed!).toBeGreaterThanOrEqual(2.5)
    await expect(page.locator("html")).toHaveAttribute("data-splash-final", "1")
    expect(await page.locator("#org-splash").evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length)).toBe(0)
  })

  test("never a bare wallpaper and never two loaders: every frame from the first to the removal", async ({ page, context, baseURL }) => {
    await cookies(context, baseURL!, Date.now() - 1200)
    await installProbe(page)
    await page.goto("/dashboard", { waitUntil: "commit" })
    await page.waitForFunction(() => Boolean(document.getElementById("org-splash")) && !document.documentElement.hasAttribute("data-splash"), undefined, { timeout: 30000 })
    await expect(page.locator("[data-app-scroll]")).toBeVisible()
    await page.waitForTimeout(800)
    const s = await sample(page)
    expect(s.frames).toBeGreaterThan(20)
    expect(s.bare).toBe(0)
    expect(s.many, JSON.stringify((s as unknown as { who?: string[] }).who)).toBe(0)
    // It cleaned up after itself: no cookies left to replay it.
    const names = (await context.cookies()).map((c) => c.name)
    expect(names).not.toContain("org_splash")
    expect(names).not.toContain("org_splash_ret")
  })

  test("the elapsed time is monotonic across documents", async ({ page, context, baseURL }) => {
    const start = Date.now() - 300
    await cookies(context, baseURL!, start)
    await installProbe(page)
    const read = async () => {
      await page.goto("/dashboard", { waitUntil: "commit" })
      await page.waitForFunction(() => (window as unknown as { __s: Sample }).__s?.firstShown !== null)
      return (await sample(page)).firstElapsed!
    }
    const first = await read()
    // The next document of the chain (same cookies, a moment later): it has played at least as much.
    await context.addCookies([{ name: "org_splash", value: String(start), url: baseURL! }])
    await page.waitForTimeout(500)
    const second = await read()
    expect(second).toBeGreaterThanOrEqual(first)
  })

  test("not for the wrong page, not for an old login", async ({ page, context, baseURL }) => {
    await cookies(context, baseURL!, Date.now() - 500)
    await page.goto("/login")
    // A Google sign-in that was cancelled lands back on /login: no splash there.
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-splash"))).toBe(false)
    await context.clearCookies()
    await cookies(context, baseURL!, Date.now() - 40_000)
    await page.goto("/dashboard")
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-splash"))).toBe(false)
  })

  test("a long stay on Google's page: the window counts from the return stamp", async ({ page, context, baseURL }) => {
    await cookies(context, baseURL!, Date.now() - 90_000, Date.now() - 400)
    await installProbe(page)
    await page.goto("/dashboard", { waitUntil: "commit" })
    await page.waitForFunction(() => (window as unknown as { __s: Sample }).__s?.firstShown !== null)
    expect((await sample(page)).firstShown).toBe(true)
    await expect(page.locator("html")).toHaveAttribute("data-splash-final", "1")
  })

  test("reduced motion: the static logo from the first frame", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } })
    await cookies(ctx, baseURL!, Date.now() - 300)
    const page = await ctx.newPage()
    await installProbe(page)
    await page.goto("/dashboard", { waitUntil: "commit" })
    await page.waitForFunction(() => (window as unknown as { __s: Sample }).__s?.firstShown !== null)
    expect((await sample(page)).firstShown).toBe(true)
    await expect(page.locator("html")).toHaveAttribute("data-splash-final", "1")
    await page.waitForFunction(() => Boolean(document.getElementById("org-splash")) && !document.documentElement.hasAttribute("data-splash"), undefined, { timeout: 30000 })
    expect((await sample(page)).bare).toBe(0)
    await ctx.close()
  })

  test("debug log: ?splashDebug=1 records the documents and shows the panel", async ({ page, context, baseURL }) => {
    await cookies(context, baseURL!, Date.now() - 600)
    await page.goto("/dashboard?splashDebug=1")
    await expect(page.getByText("Splash log")).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole("button", { name: "Copiar" })).toBeVisible()
    const log = await page.evaluate(() => JSON.parse(sessionStorage.getItem("splashLog") ?? "[]") as { ev: string }[])
    const events = log.map((e) => e.ev)
    expect(events).toContain("doc-start")
    expect(events).toContain("boot")
    expect(events).toContain("splash-shown-from-server-html")
    expect(events).toContain("controller-mounted")
    await expect.poll(async () => (await page.evaluate(() => JSON.parse(sessionStorage.getItem("splashLog") ?? "[]") as { ev: string }[])).map((e) => e.ev), { timeout: 30000 }).toContain("splash-removed")
    // Turned off again.
    await page.goto("/dashboard?splashDebug=0")
    await expect(page.getByText("Splash log")).toHaveCount(0)
  })
})
