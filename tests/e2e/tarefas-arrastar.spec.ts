/**
 * Tarefas: touch drag to reorder and move (Kanban and Lista), mobile first.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test tarefas-arrastar
 * Reload persistence is not asserted here: the fixture API lives in memory (the real adapter is covered by real-data.spec.ts).
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function mobile(browser: Browser, baseURL: string) {
  const context: BrowserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
  const page = await context.newPage()
  return { context, page }
}

async function open(page: Page, view: string) {
  await page.goto(`/design-system/tarefas?view=${view}`)
  await expect(page.locator('button[aria-label^="Quadro:"]')).toBeVisible({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
  await page.waitForTimeout(500)
}

type Pt = { x: number; y: number }
async function touch(page: Page, path: Pt[], { hold = 350, dwellAt, dwell = 0 }: { hold?: number; dwellAt?: number; dwell?: number } = {}) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [path[0]] })
  await page.waitForTimeout(hold)
  for (let i = 1; i < path.length; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [path[i]] })
    await page.waitForTimeout(30)
    if (dwellAt === i) await page.waitForTimeout(dwell)
  }
  await page.waitForTimeout(150)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
}
const line = (a: Pt, b: Pt, steps = 14): Pt[] => Array.from({ length: steps + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps }))
const centerOf = async (page: Page, selector: string, index = 0, dx = 80): Promise<Pt> => {
  const box = (await page.locator(selector).nth(index).boundingBox())!
  return { x: box.x + dx, y: box.y + box.height / 2 }
}
const titles = (page: Page, scope: string) => page.locator(`${scope} [data-task-title]`).allInnerTexts()

test.describe("touch drag, 390px", () => {
  test("Kanban: a long press reorders inside a list", async ({ browser, baseURL }) => {
    const { context, page } = await mobile(browser, baseURL!)
    await open(page, "kanban")
    const before = await titles(page, "[data-column]:visible")
    const from = await centerOf(page, "[data-column] [data-task-id]", 0)
    const to = await centerOf(page, "[data-column] [data-task-id]", 2)
    await touch(page, line(from, { x: to.x, y: to.y + 10 }))
    await expect.poll(async () => (await titles(page, "[data-column]:visible"))[0]).not.toBe(before[0])
    const after = await titles(page, "[data-column]:visible")
    expect(after[2]).toBe(before[0])
    await context.close()
  })

  test("Kanban: hovering a list tab ~500 ms switches the list; dropping inside lands there", async ({ browser, baseURL }) => {
    const { context, page } = await mobile(browser, baseURL!)
    await open(page, "kanban")
    const moved = (await titles(page, "[data-column]"))[0]
    const from = await centerOf(page, "[data-column] [data-task-id]", 0)
    const tab = page.locator("[data-list-tab]").nth(1)
    const tabBox = (await tab.boundingBox())!
    const tabPt = { x: tabBox.x + tabBox.width / 2, y: tabBox.y + tabBox.height / 2 }
    const drop = { x: 190, y: 600 }
    await touch(page, [...line(from, tabPt, 10), ...line(tabPt, drop, 10).slice(1)], { dwellAt: 10, dwell: 900 })
    await expect(tab).toHaveAttribute("aria-selected", "true")
    await expect(page.locator("[data-column]:visible").filter({ hasText: moved }).first()).toBeVisible()
    await context.close()
  })

  test("Kanban: dropping on a tab appends to that list", async ({ browser, baseURL }) => {
    const { context, page } = await mobile(browser, baseURL!)
    await open(page, "kanban")
    const moved = (await titles(page, "[data-column]"))[0]
    const from = await centerOf(page, "[data-column] [data-task-id]", 0)
    const tabBox = (await page.locator("[data-list-tab]").nth(1).boundingBox())!
    await touch(page, line(from, { x: tabBox.x + tabBox.width / 2, y: tabBox.y + tabBox.height / 2 }, 12))
    await page.locator("[data-list-tab]").nth(1).click()
    const target = await page.locator("[data-list-tab]").nth(1).getAttribute("data-list-tab")
    const column = `[data-column="${target}"]`
    const more = page.locator(column).getByRole("button", { name: /Ver mais/ })
    if (await more.count()) await more.click()
    await expect.poll(async () => (await titles(page, column)).at(-1)).toBe(moved)
    await context.close()
  })

  test("a quick swipe still scrolls and a horizontal swipe still reveals the actions", async ({ browser, baseURL }) => {
    const { context, page } = await mobile(browser, baseURL!)
    await open(page, "kanban")
    const before = await titles(page, "[data-column]:visible")
    const from = await centerOf(page, "[data-column] [data-task-id]", 1)
    await touch(page, line(from, { x: from.x, y: from.y - 160 }, 8), { hold: 0 })
    expect(await titles(page, "[data-column]:visible")).toEqual(before)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(20)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(300)
    const card = await centerOf(page, "[data-column] [data-task-id]", 0, 200)
    await touch(page, line(card, { x: card.x - 160, y: card.y }, 8), { hold: 0 })
    await expect(page.getByRole("button", { name: "Adiar 1 h" }).first()).toBeVisible()
    await context.close()
  })

  test("the card menu moves a task up/down and 'Mover para…' opens the picker", async ({ browser, baseURL }) => {
    const { context, page } = await mobile(browser, baseURL!)
    await open(page, "kanban")
    const before = await titles(page, "[data-column]:visible")
    const menu = () => page.getByRole("button", { name: `Mais ações: ${before[0]}`, exact: true })
    await menu().click()
    await page.getByRole("menuitem", { name: "Mover para baixo" }).click()
    await expect.poll(async () => (await titles(page, "[data-column]:visible"))[1]).toBe(before[0])
    await menu().click()
    await page.getByRole("menuitem", { name: "Mover para cima" }).click()
    await expect.poll(async () => (await titles(page, "[data-column]:visible"))[0]).toBe(before[0])
    await menu().click()
    await page.getByRole("menuitem", { name: "Mover para…" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await context.close()
  })

  test("Lista: a long press reorders inside a group", async ({ browser, baseURL }) => {
    const { context, page } = await mobile(browser, baseURL!)
    await open(page, "lista")
    const scope = "[data-group]:first-of-type"
    const before = await titles(page, scope)
    const from = await centerOf(page, `${scope} [data-task-id]`, 0)
    const to = await centerOf(page, `${scope} [data-task-id]`, 2)
    await touch(page, line(from, { x: to.x, y: to.y + 10 }))
    await expect.poll(async () => (await titles(page, scope))[0]).not.toBe(before[0])
    await context.close()
  })
})
