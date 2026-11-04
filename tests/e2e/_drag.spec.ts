import { test, expect, type Page } from "@playwright/test"
const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, hold = 350) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] })
  await page.waitForTimeout(hold)
  const steps = 14
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }] })
    await page.waitForTimeout(30)
  }
  await page.waitForTimeout(150)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
}

test("probe touch drag in kanban", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
  const page = await context.newPage()
  await page.goto(`/design-system/tarefas?view=kanban`)
  await expect(page.locator('button[aria-label^="Quadro:"]')).toBeVisible({ timeout: 60000 })
  await page.waitForTimeout(800)
  const titles = () => page.locator("[data-column]:visible [data-task-title]").allInnerTexts()
  const before = await titles()
  console.log("before", JSON.stringify(before.slice(0, 4)))
  const first = (await page.locator("[data-task-id]").first().boundingBox())!
  const second = (await page.locator("[data-task-id]").nth(1).boundingBox())!
  await touchDrag(page, { x: first.x + 80, y: first.y + first.height / 2 }, { x: first.x + 80, y: second.y + second.height - 4 })
  await page.waitForTimeout(500)
  console.log("after", JSON.stringify((await titles()).slice(0, 4)))
})
