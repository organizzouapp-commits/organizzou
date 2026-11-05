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

type Probe = { added: number; topmost: string[] }

/** Installs the probe before any page script runs: counts added loading logos and samples which one is on top every frame. */
async function installProbe(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __logo: { added: number; topmost: string[]; seen: WeakMap<Element, string> } }
    w.__logo = { added: 0, topmost: [], seen: new WeakMap() }
    let next = 0
    const counted = new WeakSet<Element>()
    const isLogo = (el: Element): el is HTMLImageElement => el instanceof HTMLImageElement && /organizzou-logo-carregamento/.test(el.getAttribute("src") ?? "")
    new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return
        // One loader instance = one [role=status] "Carregando" root (each holds a dark and a light <img>).
        for (const root of [n, ...Array.from(n.querySelectorAll("[role=status]"))]) if (root.getAttribute("role") === "status" && root.getAttribute("aria-label") === "Carregando" && root.querySelector("img") && !counted.has(root)) {
          counted.add(root)
          w.__logo.added += 1
        }
      })
    }).observe(document, { childList: true, subtree: true })
    const sample = () => {
      const logos = Array.from(document.querySelectorAll("img")).filter(isLogo).filter((i) => getComputedStyle(i).display !== "none")
      for (const img of logos) {
        const box = img.getBoundingClientRect()
        if (box.width === 0) continue
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        if (top === img) {
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
    return { added: w.__logo.added, topmost: w.__logo.topmost }
  })
}

test("login -> dashboard: one loading logo is ever on top, and it is added once", async ({ page }) => {
  await installProbe(page)
  const probe = await runHandoff(page)
  expect(probe.topmost).toHaveLength(1)
  expect(probe.added).toBeLessThanOrEqual(1)
})

test("same with a throttled CPU and network", async ({ page, context }) => {
  await installProbe(page)
  const cdp: CDPSession = await context.newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
  await cdp.send("Network.enable")
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 })
  const probe = await runHandoff(page)
  expect(probe.topmost).toHaveLength(1)
  expect(probe.added).toBeLessThanOrEqual(1)
})

test("reduced motion: still a single logo", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" })
  await ctx.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
  const page = await ctx.newPage()
  await installProbe(page)
  const probe = await runHandoff(page)
  expect(probe.topmost).toHaveLength(1)
  await ctx.close()
})
