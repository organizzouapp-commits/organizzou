/**
 * The loading logo of the login hand-off plays exactly once.
 *
 * The animated logo is an SVG inside an <img>, so its own `animationstart` never reaches the page. What the person sees as "the animation
 * playing again" is a second logo <img> being painted on top (a second loader instance, or the same one remounted): its SVG starts from
 * frame 0. So this counts the distinct loading-logo <img> elements that were ever the TOPMOST thing at the logo's position while the
 * hand-off runs (/login -> overlay -> /dashboard -> overlay gone), and the number of loader instances ("Carregando" roots with a logo) added to the DOM.
 *
 * The hand-off is started through the dev-only window hook (a real sign-in needs Supabase):
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test login-logo
 */
import { expect, test, type CDPSession, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
})

type Probe = { added: number; topmost: string[]; bare: number }

/** Installs the probe before any page script runs: counts added loading logos and samples which one is on top every frame. */
async function installProbe(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __logo: { added: number; topmost: string[]; seen: WeakMap<Element, string>; bare: number } }
    w.__logo = { added: 0, topmost: [], seen: new WeakMap(), bare: 0 }
    let next = 0
    const counted = new WeakSet<Element>()
    new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return
        // One loader instance = one [role=status] "Carregando" root (each holds a dark and a light <img>).
        for (const root of [n, ...Array.from(n.querySelectorAll("[role=status]"))]) if (root.id !== "org-splash" && root.getAttribute("role") === "status" && root.getAttribute("aria-label") === "Carregando" && root.querySelector(".org-splash-logo, img") && !counted.has(root)) {
          counted.add(root)
          w.__logo.added += 1
        }
      })
    }).observe(document, { childList: true, subtree: true })
    const sample = () => {
      // The wallpaper must never be what the person sees: on /dashboard, with no overlay, the shell has to carry content already.
      if (location.pathname.startsWith("/dashboard") && !document.querySelector("[data-handoff]")) {
        const shell = document.querySelector("[data-app-scroll]")
        if (!shell || (shell.textContent ?? "").trim().length <= 20 || document.querySelector(".page-skeleton")) w.__logo.bare += 1
      }
      // The logo is an inline SVG now (.org-splash-logo), the same markup in the hand-off overlay, the route loaders and the server-rendered splash.
      const logos = Array.from(document.querySelectorAll(".org-splash-logo")).filter((i) => i.getClientRects().length > 0)
      for (const img of logos) {
        const box = img.getBoundingClientRect()
        if (box.width === 0) continue
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        if (top && img.contains(top)) {
          if (!w.__logo.seen.has(img)) w.__logo.seen.set(img, `logo-${(next += 1)}`)
          const id = w.__logo.seen.get(img)!
          if (!w.__logo.topmost.includes(id)) w.__logo.topmost.push(id)
        }
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}

async function runHandoff(page: Page) {
  await page.goto("/login")
  await page.waitForFunction(() => Boolean((window as unknown as { __startLoadingHandoff?: unknown }).__startLoadingHandoff))
  await page.evaluate(() => (window as unknown as { __startLoadingHandoff: (href: string) => void }).__startLoadingHandoff("/dashboard"))
  await expect(page.getByRole("status", { name: "Carregando" })).toBeVisible()
  await page.waitForURL(/\/dashboard$/, { timeout: 30000 })
  await expect(page.getByRole("status", { name: "Carregando" })).toHaveCount(0, { timeout: 30000 })
  await expect(page.locator("[data-app-scroll]")).toBeVisible()
  await page.waitForTimeout(1500)
  return page.evaluate(() => {
    const w = window as unknown as { __logo: Probe }
    return { added: w.__logo.added, topmost: w.__logo.topmost, bare: w.__logo.bare }
  })
}

test("login -> dashboard: one loading logo is ever on top, and it is added once", async ({ page }) => {
  await installProbe(page)
  const probe = await runHandoff(page)
  expect(probe.topmost).toHaveLength(1)
  expect(probe.added).toBeLessThanOrEqual(1)
  expect(probe.bare).toBe(0)
})

test("same with a throttled CPU and network", async ({ page, context }) => {
  test.setTimeout(150_000)
  await installProbe(page)
  const cdp: CDPSession = await context.newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
  await cdp.send("Network.enable")
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 })
  const probe = await runHandoff(page)
  // Under this throttle the dashboard takes longer than the 8 s hard limit: the overlay leaves and the fallback full page load continues the SAME splash
  // (cookie), so still only one logo is ever on top. (Loader roots hidden by CSS in the new document are not duplicates, so `added` is not asserted.)
  expect(probe.topmost).toHaveLength(1)
})

test("reduced motion: still a single logo", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" })
  await ctx.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
  const page = await ctx.newPage()
  await installProbe(page)
  await page.goto("/login")
  await page.waitForFunction(() => Boolean((window as unknown as { __startLoadingHandoff?: unknown }).__startLoadingHandoff))
  await page.evaluate(() => (window as unknown as { __startLoadingHandoff: (href: string) => void }).__startLoadingHandoff("/dashboard"))
  // The still logotype, no animated SVG at all.
  const overlay = page.locator("[data-handoff]")
  await expect(overlay.locator("img[src*='logotipo']").first()).toBeAttached()
  await expect(overlay.locator(".org-splash-logo")).toHaveCount(0)
  await page.waitForURL(/\/dashboard$/, { timeout: 30000 })
  await expect(page.locator("[data-handoff]")).toHaveCount(0, { timeout: 30000 })
  const probe = await page.evaluate(() => (window as unknown as { __logo: Probe }).__logo)
  expect(probe.topmost).toHaveLength(0)
  expect(probe.bare).toBe(0)
  await ctx.close()
})

/**
 * The real thing: the sign-in form, against a production build (npm run build && npx next start -p 3210; BASE=http://localhost:3210) and an
 * existing test account:  E2E_LOGIN_EMAIL=... E2E_LOGIN_PASSWORD=... BASE=... npx playwright test login-logo
 * Without credentials this is skipped (the hand-off hook above only exists in development).
 */
test("production: a real sign-in plays the splash once and never shows the bare wallpaper", async ({ page }) => {
  const email = process.env.E2E_LOGIN_EMAIL
  const password = process.env.E2E_LOGIN_PASSWORD
  test.skip(!email || !password, "needs E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD (a real test account)")
  test.setTimeout(120000)
  await installProbe(page)
  await page.goto("/login")
  await page.getByLabel("E-mail").fill(email!)
  await page.getByLabel("Senha", { exact: false }).first().fill(password!)
  await page.getByRole("button", { name: /Entrar|Conectando/ }).first().click()
  await page.waitForURL(/\/dashboard/, { timeout: 60000 })
  await expect(page.getByRole("status", { name: "Carregando" })).toHaveCount(0, { timeout: 30000 })
  await page.waitForTimeout(2000)
  const probe = await page.evaluate(() => (window as unknown as { __logo: Probe }).__logo)
  expect(probe.topmost).toHaveLength(1)
  expect(probe.bare).toBe(0)
})

test("desktop login: the logo sits at the top-left of the glass card, the copy at the bottom", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/login")
  const box = await page.evaluate(() => {
    const aside = document.querySelector("aside[aria-label=Organizzou]")!
    const a = aside.getBoundingClientRect()
    const logo = [...aside.querySelectorAll("img[src*=logo]")].find((i) => i.getClientRects().length > 0)!.getBoundingClientRect()
    const copy = aside.querySelector("h2, h1")!.getBoundingClientRect()
    return { x: logo.x - a.x, y: logo.y - a.y, copyBottom: a.bottom - copy.bottom }
  })
  expect(box.y).toBeLessThanOrEqual(40) // the card's inner padding (28 px), not the middle of the card
  expect(box.x).toBeLessThanOrEqual(40)
  expect(box.copyBottom).toBeLessThan(200)
})
