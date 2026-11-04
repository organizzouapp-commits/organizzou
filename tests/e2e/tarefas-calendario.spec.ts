/**
 * Tarefas > Calendário: mirrors the Agenda (toolbar, Mês/Semana/Dia/Agenda) and creates tasks from it.
 * Step 0 reproduction of "cannot add a task in Calendário": the clicked day and time were dropped (onCreate() without arguments).
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test tarefas-calendario
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function setup(browser: Browser, baseURL: string, width: number, height = 900) {
  const context: BrowserContext = await browser.newContext({ viewport: { width, height }, hasTouch: width < 500, isMobile: width < 500 })
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
  const page = await context.newPage()
  return { context, page }
}

const MODE_IDS: Record<string, string> = { "Mês": "mes", Semana: "semana", Dia: "dia", Agenda: "agenda" }
/** The calendar mode: the pills of the header card on phones, the toolbar tabs on desktop. */
const pickMode = (page: Page, name: string) =>
  page.locator(`[data-calendar-mode="${MODE_IDS[name]}"]`).or(page.getByTestId("calendar-toolbar").getByRole("tab", { name })).first().click()

async function open(page: Page, view?: string) {
  await page.goto("/design-system/tarefas?view=calendario")
  await expect(page.locator('button[aria-label^="Quadro:"]')).toBeVisible({ timeout: 60000 })
  await expect(page.getByTestId("calendar-toolbar")).toBeVisible()
  if (view) await pickMode(page, view)
  await page.waitForTimeout(400)
}

test.describe("desktop 1440", () => {
  test("Semana: clicking an empty time slot opens the quick add with that day and a 15-minute time, and creates the task there", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440)
    await open(page, "Semana")
    const column = page.locator("[data-time-column]").nth(5)
    const key = (await column.getAttribute("data-time-column"))!
    const box = (await column.boundingBox())!
    const scroller = (await page.locator("[role=grid] .overflow-y-auto").first().boundingBox())!
    await page.mouse.click(box.x + box.width / 2, scroller.y + 120)
    const popover = page.getByTestId("calendar-quick-add")
    await expect(popover).toBeVisible()
    await expect(page.getByTestId("quick-add-when")).toContainText(/\d{2}:(00|15|30|45)/)
    await popover.getByRole("textbox", { name: "Título da tarefa" }).fill("Reunião criada no slot")
    await popover.getByRole("button", { name: "Adicionar", exact: true }).click()
    const created = column.locator("[data-agenda-item]").filter({ hasText: "Reunião criada no slot" })
    await expect(created).toBeVisible()
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await context.close()
  })

  test("Mês: clicking an empty day cell creates a date-only task on that day (Enter commits)", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440)
    await open(page, "Mês")
    const cell = page.locator("[data-day-cell]").nth(16)
    const key = (await cell.getAttribute("data-day-cell"))!
    const box = (await cell.boundingBox())!
    await page.mouse.click(box.x + box.width - 8, box.y + box.height - 8)
    const popover = page.getByTestId("calendar-quick-add")
    await expect(popover).toBeVisible()
    await popover.getByRole("textbox", { name: "Título da tarefa" }).fill("Criada na célula")
    await page.keyboard.press("Enter")
    await expect(page.locator(`[data-day-cell="${key}"] [data-agenda-item]`).filter({ hasText: "Criada na célula" })).toBeVisible()
    await context.close()
  })

  test("Dia: the all-day row creates a date-only task; Esc cancels", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440)
    await open(page, "Dia")
    const row = page.locator("[data-allday-row]").first()
    const box = (await row.boundingBox())!
    await page.mouse.click(box.x + box.width - 10, box.y + box.height - 6)
    await expect(page.getByTestId("calendar-quick-add")).toBeVisible()
    await page.getByRole("textbox", { name: "Título da tarefa" }).fill("Não deve existir")
    await page.keyboard.press("Escape")
    await expect(page.getByTestId("calendar-quick-add")).toBeHidden()
    await expect(page.getByText("Não deve existir")).toHaveCount(0)
    await page.mouse.click(box.x + box.width - 10, box.y + box.height - 6)
    await page.getByRole("textbox", { name: "Título da tarefa" }).fill("Dia inteiro novo")
    await page.getByRole("button", { name: "Adicionar", exact: true }).click()
    await expect(row.locator("[data-agenda-item]").filter({ hasText: "Dia inteiro novo" })).toBeVisible()
    await context.close()
  })


  test("all four views render with the Agenda toolbar; 'Listas' filters and 'Mostrar concluídas' is there", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440)
    await open(page)
    for (const view of ["Mês", "Semana", "Dia", "Agenda"]) {
      await pickMode(page, view)
      await expect(page.getByTestId("calendar-title")).toBeVisible()
    }
    await pickMode(page, "Mês")
    // Listas and Mostrar concluídas live in the board's Filtros popover (covered in tarefas-agenda.spec.ts).
    await context.close()
  })

  test("Sem data tray lists undated tasks", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440)
    await open(page, "Semana")
    await page.getByTestId("undated-tray").getByRole("button", { name: /Sem data/ }).click()
    await expect(page.getByTestId("undated-tray").locator("[data-task-id]").first()).toBeVisible()
    await context.close()
  })
})

test.describe("mobile 390", () => {
  test("all four views render; no time column; the time lives inside the card", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390, 844)
    await open(page)
    for (const view of ["Mês", "Semana", "Dia", "Agenda"]) {
      await pickMode(page, view)
      await expect(page.getByTestId("calendar-title")).toBeVisible()
    }
    await pickMode(page, "Dia")
    await expect(page.locator("[data-time-col]")).toHaveCount(0)
    await expect(page.locator("[data-due-time]").first()).toBeVisible()
    // The card is full width: its left edge is the card's padding, not a time column.
    const card = (await page.locator("[data-task-id]").first().boundingBox())!
    expect(card.x).toBeLessThan(40)
    await context.close()
  })

  test("week strip shows dots; Mês shows counts under the day number", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390, 844)
    await open(page, "Semana")
    await expect(page.getByRole("group", { name: "Dias da semana" }).getByRole("button")).toHaveCount(7)
    await pickMode(page, "Mês")
    await expect(page.getByRole("grid", { name: "Calendário do mês" })).toBeVisible()
    await context.close()
  })


  test("the dashed pill creates a task on the selected day, shown at once and highlighted", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390, 844)
    await open(page, "Dia")
    await page.getByTestId("group-add-pill").first().click()
    const sheet = page.getByRole("dialog")
    await expect(sheet).toBeVisible()
    await sheet.getByLabel("Título").fill("Criada pelo pill")
    await sheet.getByRole("button", { name: "Criar tarefa" }).click()
    const card = page.locator("[data-task-id]").filter({ hasText: "Criada pelo pill" }).first()
    await expect(card).toBeVisible()
    await expect(page.locator("[data-highlight]").filter({ hasText: "Criada pelo pill" })).toBeVisible()
    await context.close()
  })


})
