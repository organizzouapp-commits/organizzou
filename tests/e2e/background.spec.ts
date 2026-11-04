/**
 * The photo background must render for a brand-new visitor (empty storage, no cookies): the login page, a public app-shell page and,
 * when the dev bypass is on, the dashboard. Run against a production server to mirror Vercel:
 *   npm run build && PORT=3210 npx next start -p 3210 ; BASE=http://localhost:3210 npx playwright test background
 */
import { expect, test, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

/** Loads `path` with empty storage and returns the status of every image request plus what the page's background <img> decoded. */
async function load(page: Page, path: string) {
  const images: { url: string; status: number; type: string }[] = []
  page.on("response", (res) => {
    const type = res.headers()["content-type"] ?? ""
    if (type.startsWith("image/") && /images\/(app-bg|auth-background)|_next\/image/.test(res.url())) images.push({ url: res.url(), status: res.status(), type })
  })
  await page.goto(path, { waitUntil: "load" })
  await page.waitForTimeout(1500)
  const decoded = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img")).filter((i) => /app-bg|auth-background|_next\/image/.test(i.currentSrc || i.src))
    return imgs.map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, complete: i.complete }))
  })
  return { images, decoded }
}

for (const [label, size] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
  test.describe(`background ${label}`, () => {
    test.use({ viewport: size, storageState: { cookies: [], origins: [] } })

    test("login: the photo loads (200, decoded) with empty storage", async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
      const { images, decoded } = await load(page, "/login")
      expect(images.length).toBeGreaterThan(0)
      expect(images.every((i) => i.status === 200)).toBe(true)
      expect(decoded.length).toBeGreaterThan(0)
      expect(decoded.every((d) => d.complete && d.w > 0)).toBe(true)
    })

    test("app shell (public Políticas page): the photo loads with empty storage", async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
      const { images, decoded } = await load(page, "/politicas")
      expect(images.filter((i) => /app-bg/.test(i.url)).length).toBeGreaterThan(0)
      expect(images.every((i) => i.status === 200)).toBe(true)
      expect(decoded.some((d) => /app-bg/.test(d.src) && d.complete && d.w > 0)).toBe(true)
      const bg = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>("img[src*='app-bg']")
        return el ? getComputedStyle(el).display : "none"
      })
      expect(bg).not.toBe("none")
    })

    test("dashboard (dev bypass only): the shell photo loads", async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
      const { images, decoded } = await load(page, "/dashboard")
      test.skip(/\/login/.test(page.url()), "needs a session (PROTOTYPE_BYPASS_AUTH=1 in dev)")
      expect(images.filter((i) => /app-bg/.test(i.url)).length).toBeGreaterThan(0)
      expect(images.every((i) => i.status === 200)).toBe(true)
      expect(decoded.some((d) => /app-bg/.test(d.src) && d.w > 0)).toBe(true)
    })
  })
}
