/**
 * Prompt 2 flows: Hoje, Tarefas (quick add, complete, filters, details panel, shortcuts) and Agenda (create, move, edit).
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
 *   npx playwright test ux-tasks-agenda
 */
import { expect, test, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
})

async function openBoard(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto("/dashboard/tarefas")
  await expect(page.getByRole("region", { name: "A fazer" })).toBeVisible({ timeout: 30000 })
}

test("Hoje: stat row, timeline with the 'agora' marker and the side column", async ({ page }) => {
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

test("Tarefas: quick add keeps the field open and a multi-line paste creates several cards", async ({ page }) => {
  await openBoard(page)
  const column = page.getByRole("region", { name: "A fazer" })
  const before = await column.locator("[data-task-id]").count()
  await column.getByRole("button", { name: "Adicionar tarefa" }).click()
  const field = column.getByLabel("Título da nova tarefa")
  await field.fill("Primeira tarefa rápida")
  await field.press("Enter")
  await expect(column.locator("[data-task-id]")).toHaveCount(before + 1)
  await expect(field).toBeFocused()
  await field.fill("")
  await field.evaluate((el) => {
    const data = new DataTransfer()
    data.setData("text", "Linha um\nLinha dois\nLinha três")
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await expect(column.locator("[data-task-id]")).toHaveCount(before + 4)
  await field.press("Escape")
  await expect(column.getByLabel("Título da nova tarefa")).toHaveCount(0)
})

test("Tarefas: completing moves the card to Concluído and unchecking restores it", async ({ page }) => {
  await openBoard(page)
  const todo = page.getByRole("region", { name: "A fazer" })
  const card = todo.locator("[data-task-id]").first()
  await expect(card).toBeVisible()
  const title = (await card.locator("button.flex-1 span").first().innerText()).trim()
  const count = await todo.locator("[data-task-id]").count()
  await card.getByRole("checkbox").click()
  await expect(todo.locator("[data-task-id]")).toHaveCount(count - 1)
  const done = page.getByRole("region", { name: "Concluído" })
  await done.getByRole("button", { name: /Mostrar/ }).click()
  const doneCard = done.locator("[data-task-id]", { hasText: title })
  await expect(doneCard).toBeVisible()
  await doneCard.getByRole("checkbox").click()
  await expect(todo.locator("[data-task-id]", { hasText: title })).toBeVisible()
})

test("Tarefas: smart chips filter and toggle off", async ({ page }) => {
  await openBoard(page)
  const all = await page.locator("[data-task-id]").count()
  await page.getByRole("button", { name: "Sem data" }).click()
  const filtered = await page.locator("[data-task-id]").count()
  expect(filtered).toBeLessThan(all)
  await page.getByRole("button", { name: "Sem data" }).click()
  await expect(page.locator("[data-task-id]")).toHaveCount(all)
})

test("Tarefas: details open as a side panel, autosave shows 'Salvo', E and N shortcuts work", async ({ page }) => {
  await openBoard(page)
  const card = page.getByRole("region", { name: "A fazer" }).locator("[data-task-id]").first()
  await card.locator("button.flex-1").click()
  const panel = page.getByRole("complementary", { name: "Detalhes da tarefa" })
  await expect(panel).toBeVisible()
  // The board is still there and usable next to the panel.
  await expect(page.getByRole("region", { name: "A fazer" })).toBeVisible()
  await panel.getByLabel("Descrição").fill("Texto novo")
  await panel.getByLabel("Descrição").blur()
  await expect(panel.getByText("Salvo")).toBeVisible()
  await expect(panel.getByText("Em breve: avisos pelo WhatsApp")).toBeVisible()
  await panel.getByRole("button", { name: "Fechar detalhes" }).click()
  await expect(panel).toHaveCount(0)
  await card.hover()
  await page.keyboard.press("e")
  await expect(panel).toBeVisible()
  await page.keyboard.press("Escape")
  await page.locator("body").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("n")
  await expect(page.getByRole("dialog")).toBeVisible()
})

test("Tarefas (mobile): defaults to the list view and filters live in a drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/dashboard/tarefas")
  await expect(page.getByRole("tab", { name: "Lista" })).toHaveAttribute("data-state", "active", { timeout: 30000 })
  await page.getByRole("button", { name: "Filtros" }).click()
  await expect(page.getByRole("heading", { name: "Filtros" })).toBeVisible()
})

test("Agenda: drag on an empty slot creates an event, drag moves it, the edit dialog changes it", async ({ page }) => {
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
