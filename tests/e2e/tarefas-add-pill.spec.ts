/**
 * Tarefas: ONE "Adicionar tarefa…" pill everywhere, and "Sem data" as the last group of the day.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test tarefas-add-pill
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function setup(browser: Browser, baseURL: string, width: number, height = 900) {
  const context: BrowserContext = await browser.newContext({ viewport: { width, height }, hasTouch: width < 500, isMobile: width < 500 })
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
  const page = await context.newPage()
  return { context, page }
}

async function open(page: Page, view: string) {
  await page.goto(`/design-system/tarefas?view=${view}`)
  await expect(page.locator('button[aria-label^="Quadro:"]').first()).toBeVisible({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
  await page.waitForTimeout(400)
}

const rect = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!
const css = (locator: ReturnType<Page["locator"]>, prop: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)

for (const [label, width, height] of [["mobile 390", 390, 44], ["desktop 1440", 1440, 40]] as const) {
  test.describe(`1. the pill (${label})`, () => {
    test("every 'Adicionar tarefa…' in Kanban, Lista and the Agenda is the same pill", async ({ browser, baseURL }) => {
      const { context, page } = await setup(browser, baseURL!, width)
      const seen: { h: number; radius: number; style: string; width: number; bg: string; border: string }[] = []
      for (const view of ["kanban", "lista", "agenda"]) {
        await open(page, view)
        const pills = page.locator("[data-add-task-pill]")
        expect(await pills.count(), view).toBeGreaterThan(0)
        for (const pill of await pills.all()) {
          if (!(await pill.isVisible())) continue
          const box = await rect(pill)
          seen.push({ h: Math.round(box.height), radius: parseFloat(await css(pill, "border-top-left-radius")), style: await css(pill, "border-top-style"), width: Math.round(box.width), bg: await css(pill, "background-color"), border: await css(pill, "border-top-color") })
        }
      }
      expect(seen.length).toBeGreaterThan(3)
      for (const pill of seen) {
        expect(pill.h).toBe(height)
        expect(pill.style).toBe("dashed")
        expect(pill.radius).toBeGreaterThanOrEqual(height / 2)
        expect(pill.bg).toBe(seen[0].bg)
        expect(pill.border).toBe(seen[0].border)
      }
      await context.close()
    })

    test("clicking it opens an input pill of the same size, and leaving the field creates the task", async ({ browser, baseURL }) => {
      const { context, page } = await setup(browser, baseURL!, width)
      await open(page, "kanban")
      const pill = page.locator("[data-add-task-pill]").first()
      const before = await rect(pill)
      await pill.click()
      const input = page.getByRole("textbox", { name: "Título da nova tarefa" })
      await expect(input).toBeVisible()
      expect(Math.round((await rect(input)).height)).toBe(height)
      expect(Math.abs((await rect(input)).width - before.width)).toBeLessThanOrEqual(width < 500 ? 56 : 2)
      await input.fill("Criada pelo pill único")
      if (width < 500) await input.press("Enter")
      else await input.evaluate((el) => (el as HTMLElement).blur())
      await page.waitForTimeout(600)
      // Phones show 5 cards per list until "Ver mais".
      const more = page.getByRole("button", { name: /Ver mais/ })
      if (await more.count()) await more.first().click()
      await expect(page.locator("[data-task-id]").filter({ hasText: "Criada pelo pill único" }).first()).toBeAttached()
      await context.close()
    })
  })
}

test("Kanban desktop: the footer pill is a sibling of the scroll body and never overlays the last card", async ({ browser, baseURL }) => {
  const { context, page } = await setup(browser, baseURL!, 1440)
  await open(page, "kanban")
  const column = page.locator("[data-column]").first()
  const scroller = column.locator("[data-list-scroll]")
  await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight))
  await page.waitForTimeout(300)
  const footer = column.locator("[data-add-task-pill]").locator("xpath=..")
  const body = await rect(scroller)
  const foot = await rect(footer)
  expect(foot.y).toBeGreaterThanOrEqual(body.y + body.height - 1)
  const last = await rect(scroller.locator("[data-task-id]").last())
  expect(last.y + last.height).toBeLessThanOrEqual(foot.y + 1)
  expect(await css(footer, "background-color")).not.toBe("rgba(0, 0, 0, 0)")
  expect(await css(footer, "padding-left")).toBe("12px")
  expect(await css(footer, "padding-bottom")).toBe("12px")
  await context.close()
})

test.describe("2. Sem data is the last group of the day", () => {
  test("desktop rail: no separate card; the group sits inside the day card after the last list, aligned, collapsed, draggable onto the grid", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440)
    await open(page, "agenda")
    await page.getByTestId("calendar-toolbar").getByRole("tab", { name: "Semana" }).click()
    const rail = page.getByRole("complementary", { name: "Painel do calendário" })
    await expect(rail.locator("[data-slot=card], .bento-card")).toHaveCount(0)
    const dayCard = rail.getByTestId("day-lists")
    const groups = dayCard.locator("[data-group]")
    const last = groups.last()
    await expect(last).toHaveAttribute("data-group", "__undated__")
    await expect(last.getByRole("heading", { name: "Sem data" })).toBeVisible()
    await expect(last.locator("button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "false")
    // Columns line up with the first list: the count pill and the "+" share their x.
    const x = async (group: ReturnType<typeof groups.first>, selector: string) => Math.round((await rect(group.locator(selector).first())).x)
    expect(Math.abs((await x(last, "[class*=tabular]")) - (await x(groups.first(), "[class*=tabular]")))).toBeLessThanOrEqual(1)
    expect(Math.abs((await x(last, 'button[aria-label^="Adicionar tarefa em"]')) - (await x(groups.first(), 'button[aria-label^="Adicionar tarefa em"]')))).toBeLessThanOrEqual(1)
    // The "+" opens the new-task dialog (an undated task).
    await last.getByRole("button", { name: /Adicionar tarefa em Sem data/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("Escape")
    // Drag an undated task onto the week grid.
    await last.locator("button[aria-expanded]").first().click()
    const task = last.locator("[data-task-id]").first()
    await expect(task).toBeVisible()
    const column = page.locator("[data-time-column]").nth(3)
    await task.dragTo(column, { targetPosition: { x: 40, y: 200 } })
    await expect(page.getByText("Tarefa reagendada.")).toBeVisible()
    await context.close()
  })

  test("mobile: 'Sem data' is the same group — same header height and spacing, nothing in between", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390, 844)
    await open(page, "agenda")
    const groups = page.getByTestId("day-lists").locator("[data-group]")
    const n = await groups.count()
    expect(n).toBeGreaterThanOrEqual(4)
    const headers = page.getByTestId("day-lists").locator("[data-group-header]")
    const boxes = []
    for (let i = 0; i < n; i++) boxes.push(await rect(headers.nth(i)))
    for (const box of boxes) expect(Math.round(box.height)).toBe(44)
    // The last two groups are collapsed: 44 + 8 apart, like the others.
    expect(Math.round(boxes[n - 1].y - boxes[n - 2].y)).toBe(52)
    await expect(groups.last()).toHaveAttribute("data-group", "__undated__")
    expect(await css(groups.last(), "background-color")).toBe("rgba(0, 0, 0, 0)")
    // Agenda mode: still the last group, after the date groups.
    await page.locator('[data-calendar-mode="agenda"]').click()
    await expect(page.locator('[data-group="__undated__"]')).toBeVisible()
    await context.close()
  })
})
