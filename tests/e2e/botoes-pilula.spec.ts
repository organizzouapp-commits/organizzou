/**
 * Every button is a pill: radius >= half its height (icon-only buttons are circles). Visits the main screens, opens the task dialog
 * and the pickers, and checks each visible `button, [role=button]`.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test botoes-pilula
 */
import { expect, test, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

/** Not buttons in the design sense: they keep their radius. Each entry says why. */
const ALLOW = [
  // Full-width list rows inside menus/pickers/sheets are menu items, not buttons.
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="option"]',
  // Form-like triggers inside the task dialog and filters look like inputs (select-like fields keep their radius).
  '[role="combobox"]',
  // Checkboxes/switches/radios are controls, not buttons.
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  // Calendar day cells are grid cells.
  '[role="gridcell"]',
  // dnd-kit gives the draggable task card wrapper role=button; the card is a surface, not a button.
  "[data-task-id]",
  // Opted out explicitly in markup, with the reason next to it.
  "[data-pill-exempt]",
]

async function offenders(page: Page) {
  return page.evaluate((allow) => {
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>('button, [role="button"]')) {
      const box = el.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) continue
      const style = getComputedStyle(el)
      if (style.visibility === "hidden" || style.display === "none") continue
      if (el.matches(allow.join(","))) continue
      // Invisible hit areas / drag surfaces that draw nothing of their own.
      const painted = style.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(style.borderTopWidth) > 0
      if (!painted && !el.textContent?.trim() && !el.querySelector("svg")) continue
      const radius = Math.min(...[style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].map((value) => parseFloat(value) || 0))
      if (radius + 0.5 < Math.min(box.width, box.height) / 2) {
        out.push(`${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)} [${Math.round(box.width)}x${Math.round(box.height)} r=${Math.round(radius)}] ${el.className.toString().slice(0, 60)}`)
      }
    }
    return [...new Set(out)].slice(0, 12)
  }, ALLOW)
}

for (const [name, size] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]] as const) {
  test.describe(name, () => {
    test.use({ viewport: size, hasTouch: name === "mobile" })
    test.beforeEach(async ({ context, baseURL }) => context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }]))

    for (const path of ["/dashboard", "/dashboard/agenda", "/dashboard/financas", "/dashboard/configuracoes", "/design-system/tarefas?view=kanban", "/design-system/tarefas?view=lista", "/design-system/tarefas?view=calendario"]) {
      test(`${path} has only pill buttons`, async ({ page }) => {
        await page.goto(path, { waitUntil: "networkidle" })
        await page.waitForTimeout(600)
        expect(await offenders(page)).toEqual([])
      })
    }

    test("task dialog and pickers have only pill buttons", async ({ page }) => {
      await page.goto("/design-system/tarefas?view=kanban", { waitUntil: "networkidle" })
      await page.locator("[data-task-id]").first().click()
      const dialog = page.locator('[role="dialog"]').first()
      await expect(dialog).toBeVisible()
      expect(await offenders(page)).toEqual([])
      for (const label of ["Tags", "Categoria"]) {
        await page.getByRole("button", { name: label, exact: true }).first().click()
        await expect(page.locator("[data-picker-footer]").last()).toBeVisible()
        expect(await offenders(page), label).toEqual([])
        await page.keyboard.press("Escape")
      }
    })
  })
}
