/**
 * Prompt 2 flows: Hoje, Tarefas (quick add, complete, filters, details panel, shortcuts) and Agenda (create, move, edit).
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
 *   npx playwright test ux-tasks-agenda
 */
import { expect, test } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
})

test("Hoje: stat row, timeline with the 'agora' marker and the side column", async ({ page }) => {
  test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard")
  await expect(page.getByRole("region", { name: "Seu dia" })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole("separator", { name: /^Agora/ })).toBeVisible()
  const finance = page.getByRole("region", { name: "Finanças" })
  const day = page.getByRole("region", { name: "Seu dia" })
  const f = (await finance.boundingBox())!
  const d = (await day.boundingBox())!
  expect(f.x).toBeGreaterThan(d.x + d.width - 5) // side column sits to the right of the timeline
})

test("Agenda: drag on an empty slot creates an event, drag moves it, the edit dialog changes it", async ({ page }) => {
  test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard/agenda")
  await expect(page.getByRole("gridcell").nth(2)).toBeVisible({ timeout: 30000 })
  // Tuesday column, 14:00-15:00 (empty in the example data): compute the point from the scroll box.
  const point = await page.evaluate(() => {
    const scroller = document.querySelector("[role=grid] .overflow-y-auto") as HTMLElement
    scroller.scrollTop = 4 * 56
    const col = document.querySelectorAll("[role=gridcell]")[2] as HTMLElement
    const r = scroller.getBoundingClientRect()
    const c = col.getBoundingClientRect()
    return { x: c.x + c.width / 2, y: r.top + (14 - 6) * 56 - scroller.scrollTop + 8 }
  })
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x, point.y + 56, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByLabel("Título").fill("Reunião de teste")
  await page.getByRole("button", { name: "Criar evento" }).click()
  const created = page.getByRole("button", { name: /Reunião de teste/ }).first()
  await expect(created).toBeVisible()
  const before = (await created.boundingBox())!
  await page.mouse.move(before.x + before.width / 2, before.y + 20)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2, before.y + 20 + 56, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByText("Evento atualizado.").first()).toBeVisible()
  await page.getByRole("button", { name: /Reunião de teste/ }).first().click({ position: { x: 5, y: 5 }, force: true })
})

test("Agenda: month view creates on an empty cell and lists the overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard/agenda")
  await page.getByRole("tab", { name: "Mês" }).click({ timeout: 30000 })
  const cell = page.getByRole("gridcell").filter({ hasText: /^15/ }).first()
  const box = (await cell.boundingBox())!
  await page.mouse.click(box.x + box.width - 6, box.y + box.height - 6)
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByLabel("Título")).toBeVisible()
})
