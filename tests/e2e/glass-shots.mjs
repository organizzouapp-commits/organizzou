// App shell glass: screenshots of /dashboard, /dashboard/tarefas and /dashboard/financas (dark + light, desktop and mobile).
//   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
//   node tests/e2e/glass-shots.mjs      (BASE=http://localhost:3100, OUT=./test-results/glass)
import { mkdirSync } from "node:fs"
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const out = process.env.OUT ?? "test-results/glass"
mkdirSync(out, { recursive: true })
const browser = skipConsent(await chromium.launch(), base)
const only = process.env.ONLY // e.g. "1440x900"
for (const [w, h] of [[1440, 900], [1280, 800], [390, 844]]) {
  if (only && only !== `${w}x${h}`) continue
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768 })
    await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
    const page = await ctx.newPage()
    for (const [name, path] of [["inicio", "/dashboard"], ["tarefas", "/dashboard/tarefas"], ["financas", "/dashboard/financas"]]) {
      await page.goto(base + path, { waitUntil: "networkidle" })
      await page.waitForTimeout(1800)
      await page.screenshot({ path: `${out}/${name}-${w}x${h}-${theme}.png` })
    }
    await ctx.close()
  }
}
await browser.close()
console.log("done")
