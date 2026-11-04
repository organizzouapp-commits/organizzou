/**
 * Saves the four Finanças tabs at 390 and 1440, dark and light, into docs/screenshots/financas/ (for comparing the branch with main).
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test financas-screenshots
 */
import { mkdirSync } from "node:fs"

import { expect, test } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const cat = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`
// Category colors the way a person would have picked them (stored locally, like the Tarefas label colors).
const COLORS = { colors: { priority: {}, tag: {}, category: { [cat(1)]: "azul", [cat(2)]: "verde", [cat(3)]: "laranja", [cat(4)]: "amarelo", [cat(5)]: "vermelho", [cat(6)]: "azul", [cat(7)]: "laranja" }, task: {}, event: {} }, custom: [] }

const TABS = [
  { slug: "visao-geral", name: "Visão geral", short: "Geral" },
  { slug: "lancamentos", name: "Lançamentos", short: "Lançamentos" },
  { slug: "contas-fixas", name: "Contas fixas", short: "Fixas" },
  { slug: "metas", name: "Metas", short: "Metas" },
]

const OUT = "docs/screenshots/financas-bento"
mkdirSync(OUT, { recursive: true })

for (const theme of ["dark", "light"]) {
  for (const [label, size] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const) {
    test.describe(`${label} ${theme}`, () => {
      test.use({ viewport: size, hasTouch: label === "390" })
      test.beforeEach(async ({ context, baseURL }) => {
        await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
        await context.addInitScript(([t, colors]) => {
          try {
            localStorage.setItem("theme", t)
            localStorage.setItem("organizzou:tarefas-colors", colors)
          } catch {}
        }, [theme, JSON.stringify(COLORS)])
      })
      for (const tab of TABS) {
        test(`${tab.slug}`, async ({ page }) => {
          await page.goto("/design-system/financas")
          await expect(page.getByRole("tablist", { name: "Finanças" })).toBeVisible({ timeout: 60000 })
          const target = page.getByRole("tab", { name: label === "390" ? tab.short : tab.name, exact: true })
          // The first click can land before hydration finishes; click again until the tab is selected.
          await expect(async () => {
            await target.click()
            await expect(target).toHaveAttribute("aria-selected", "true", { timeout: 1500 })
          }).toPass({ timeout: 20000 })
          await page.waitForTimeout(1800)
          // A tall viewport instead of fullPage: resizing during a full-page capture restarts the chart animation.
          const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, window.innerHeight))
          await page.setViewportSize({ width: size.width, height })
          await page.waitForTimeout(1800)
          await page.screenshot({ path: `${OUT}/${tab.slug}-${label}-${theme}.png` })
        })
      }
    })
  }
}
