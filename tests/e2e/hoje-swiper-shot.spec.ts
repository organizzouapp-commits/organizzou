/**
 * Visual guard for the "Destaques" deck on Hoje (phones): saves the section's screenshot to SHOTS_OUT (default test-results/hoje-swiper)
 * and, when HOJE_BASELINE points to a folder with an earlier run, fails if the pixels moved. Used to prove the shared HighlightDeck
 * extraction changed nothing.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
 *   SHOTS_OUT=<dir> npx playwright test hoje-swiper-shot            (record)
 *   HOJE_BASELINE=<dir> SHOTS_OUT=<dir2> npx playwright test hoje-swiper-shot   (compare)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"
import sharp from "sharp"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const OUT = process.env.SHOTS_OUT ?? "test-results/hoje-swiper"
mkdirSync(OUT, { recursive: true })

for (const theme of ["dark", "light"]) {
  test(`Hoje Destaques deck at 390, ${theme}`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 1 })
    await ctx.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("theme", t)
      } catch {}
    }, theme)
    const page = await ctx.newPage()
    await page.goto("/dashboard")
    const section = page.getByRole("region", { name: "Destaques" }).first()
    await expect(section).toBeVisible({ timeout: 60000 })
    await page.waitForTimeout(2500)
    const shot = await section.screenshot({ animations: "disabled" })
    const file = path.join(OUT, `hoje-${theme}.png`)
    writeFileSync(file, shot)
    const baseline = process.env.HOJE_BASELINE ? path.join(process.env.HOJE_BASELINE, `hoje-${theme}.png`) : null
    if (baseline && existsSync(baseline)) {
      const [a, b] = await Promise.all([sharp(readFileSync(baseline)).raw().toBuffer({ resolveWithObject: true }), sharp(shot).raw().toBuffer({ resolveWithObject: true })])
      expect(b.info.width).toBe(a.info.width)
      expect(b.info.height).toBe(a.info.height)
      let moved = 0
      for (let i = 0; i < a.data.length; i += a.info.channels) {
        if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) moved += 1
      }
      expect(moved / (a.info.width * a.info.height)).toBeLessThan(0.001)
    }
    await ctx.close()
  })
}
