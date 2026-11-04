/**
 * Tarefas > Calendário: task creation (Step 0 reproduction) and the Agenda-mirroring views.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test tarefas-calendario
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function consent(context: BrowserContext, baseURL: string, theme = "dark") {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t)
    } catch {}
  }, theme)
}

async function open(page: Page, view = "calendario") {
  await page.goto(`/design-system/tarefas?view=${view}`)
  await expect(page.locator('button[aria-label^="Quadro:"]')).toBeVisible({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
}

test.describe("desktop 1440", () => {
  test("clicking an empty time slot creates a task at that day and time", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await consent(context, baseURL!)
    const page = await context.newPage()
    await open(page)
    const grid = page.locator("[role=grid]").first()
    const box = (await grid.boundingBox())!
    await page.mouse.click(box.x + box.width * 0.72, box.y + 200)
    const popover = page.getByTestId("calendar-quick-add")
    await expect(popover).toBeVisible()
    await popover.getByRole("textbox").fill("Reunião criada no slot")
    await popover.getByRole("button", { name: "Adicionar" }).click()
    const created = page.locator("[data-task-id], [role=grid] button").filter({ hasText: "Reunião criada no slot" }).first()
    await expect(created).toBeVisible()
    await context.close()
  })
})
