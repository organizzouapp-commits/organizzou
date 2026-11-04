/**
 * Tarefas, "Agenda" round: the Calendário view is now Agenda; transparent flat groups on phones; shared pills; counters bottom-right;
 * desktop toolbar, rail and framed Lista cards; soft scrollbars.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test tarefas-agenda
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function setup(browser: Browser, baseURL: string, width: number, height = 900) {
  const context: BrowserContext = await browser.newContext({ viewport: { width, height }, hasTouch: width < 500, isMobile: width < 500 })
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
  const page = await context.newPage()
  return { context, page }
}

async function open(page: Page, view = "agenda") {
  await page.goto(`/design-system/tarefas?view=${view}`)
  await expect(page.locator('button[aria-label^="Quadro:"]').first()).toBeVisible({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
  await page.waitForTimeout(400)
}

const rect = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!
const css = (locator: ReturnType<Page["locator"]>, prop: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)

test.describe("1. Agenda (renamed view)", () => {
  for (const width of [360, 390, 430]) {
    test(`label 'Agenda' in the view switcher, not clipped (${width}); both URLs open it`, async ({ browser, baseURL }) => {
      const { context, page } = await setup(browser, baseURL!, width, 800)
      await open(page, "kanban")
      const tab = page.locator('[data-view-tab="calendario"]')
      await expect(tab).toHaveAttribute("aria-label", "Agenda")
      expect(await tab.locator("span").last().evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
      await expect(page.getByText("Calendário", { exact: true })).toHaveCount(0)
      for (const view of ["calendario", "agenda"]) {
        await open(page, view)
        await expect(page.getByTestId("calendar-card")).toBeVisible()
      }
      await page.locator('[data-view-tab="kanban"]').click()
      await page.locator('[data-view-tab="calendario"]').click()
      expect(page.url()).toContain("view=agenda")
      await context.close()
    })
  }
})

test.describe("2. mobile Agenda", () => {
  test("no Hoje; the title returns to today; arrows step per mode", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390, 844)
    await open(page)
    const toolbar = page.getByTestId("calendar-toolbar")
    await expect(toolbar.getByRole("button", { name: "Hoje", exact: true })).toHaveCount(0)
    const title = page.getByTestId("calendar-title")
    await expect(title).toHaveAttribute("aria-label", "Ir para hoje")
    await expect(title).toHaveAttribute("title", "Ir para hoje")
    expect(await css(title, "cursor")).toBe("pointer")
    expect((await rect(toolbar)).height).toBe(40)
    const modes: [string, RegExp][] = [["mes", /^[a-zç]+ de \d{4}$/], ["semana", /^\d{1,2} [a-z]{3} – \d{1,2} [a-z]{3}$/], ["dia", /^[a-zç]+, \d{1,2} de [a-zç]+$/], ["agenda", /^Próximos 30 dias$/]]
    for (const [mode, pattern] of modes) {
      await page.locator(`[data-calendar-mode="${mode}"]`).click()
      const start = (await title.innerText()).trim()
      expect(start).toMatch(pattern)
      await page.getByRole("button", { name: "Próximo", exact: true }).click()
      if (mode !== "agenda") await expect(title).not.toHaveText(start)
      await title.click()
      await expect(title).toHaveText(start)
    }
    await context.close()
  })

  test("the groups sit OUTSIDE the card on the page background, flat and transparent, with Lista's spacing", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390, 844)
    await open(page)
    await page.locator('[data-calendar-mode="dia"]').click()
    const card = page.getByTestId("calendar-card")
    await expect(card.locator("[data-group]")).toHaveCount(0)
    const groups = page.getByTestId("day-lists").locator("[data-group]")
    expect(await groups.count()).toBeGreaterThanOrEqual(3)
    expect(await css(groups.first(), "background-color")).toBe("rgba(0, 0, 0, 0)")
    expect(await css(groups.first(), "border-top-width")).toBe("0px")
    // Two collapsed lists: headers 52px apart (44 + 8), as in Lista.
    const tops = await page.getByTestId("day-lists").locator("[data-group-header]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(tops[2] - tops[1]).toBe(52)
    await context.close()
  })
})

test.describe("3. shared pill rows", () => {
  test("list tabs, shortcut chips and the mode switcher share height, radius, fill and no outline; Editar is a dashed pill", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390, 844)
    const measure = async (selector: string) => {
      const pill = page.locator(selector).first()
      return { height: Math.round((await rect(pill)).height), radius: parseFloat(await css(pill, "border-top-left-radius")), border: await css(pill, "border-top-width"), fill: await css(pill, "background-color") }
    }
    await open(page, "kanban")
    const tab = await measure('[aria-label="Listas do quadro"] [data-pill][data-pill-active="false"]')
    await open(page, "lista")
    const chip = await measure('[aria-label="Atalhos"] [data-pill][data-pill-active="false"]')
    await open(page, "agenda")
    const mode = await measure('[aria-label="Modo do calendário"] [data-pill][data-pill-active="false"]')
    for (const pill of [tab, chip, mode]) {
      expect(pill.height).toBe(36)
      expect(pill.radius).toBeGreaterThanOrEqual(18)
      expect(pill.border).toBe("0px")
      expect(pill.fill).not.toBe("rgba(0, 0, 0, 0)")
    }
    expect(chip.fill).toBe(tab.fill)
    expect(mode.fill).toBe(tab.fill)
    await open(page, "lista")
    const edit = page.getByRole("button", { name: "Editar atalhos" })
    await expect(edit).toContainText("Editar")
    expect(await css(edit, "border-top-style")).toBe("dashed")
    await context.close()
  })
})

for (const width of [390, 1440]) {
  test(`4. card: counters at the bottom-right, max 2 labels + '+N' that opens Tags (${width})`, async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, width, 900)
    await open(page, "kanban")
    const card = page.locator("[data-task-id]").filter({ hasText: "Pesquisar curso" }).first()
    // Two chips, then "+1".
    await expect(card.locator("[data-label-chip]")).toHaveCount(2)
    const more = card.locator("[data-chip-more]")
    await expect(more).toHaveText("+1")
    const withCounters = page.locator("[data-task-id]").filter({ has: page.locator("[data-task-counters]") }).first()
    const box = await rect(withCounters)
    const counters = await rect(withCounters.locator("[data-task-counters]"))
    const menu = await rect(withCounters.getByRole("button", { name: /Mais ações/ }))
    expect(Math.abs(counters.x + counters.width - (menu.x + menu.width))).toBeLessThanOrEqual(2)
    expect(box.y + box.height - (counters.y + counters.height)).toBeLessThanOrEqual(16)
    expect(box.y + box.height - (counters.y + counters.height)).toBeGreaterThanOrEqual(8)
    await more.click()
    await expect(page.getByRole("dialog").last()).toBeVisible()
    await expect(page.getByTestId("picker-tag")).toBeVisible()
    await context.close()
  })
}

test("4. compact dots keep working (up to 4 dots, then +N)", async ({ browser, baseURL }) => {
  const { context, page } = await setup(browser, baseURL!, 390, 900)
  await open(page, "kanban")
  const card = page.locator("[data-task-id]").filter({ hasText: "Pesquisar curso" }).first()
  await card.locator("[data-label-chip]").first().click()
  await expect(card.locator("[data-label-chip]").first()).toHaveAttribute("aria-pressed", "true")
  expect(await card.locator("[data-label-chip]").count()).toBeLessThanOrEqual(4)
  await card.locator("[data-label-chip]").first().click()
  await context.close()
})

test.describe("5. desktop Agenda toolbar", () => {
  test("no Hoje / Nova tarefa / Listas; title and T go to today; Filtros has Listas + Mostrar concluídas and filters grid and rail", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440)
    await open(page)
    const toolbar = page.getByTestId("calendar-toolbar")
    for (const name of ["Hoje", "Nova tarefa", "Listas"]) await expect(toolbar.getByRole("button", { name, exact: true })).toHaveCount(0)
    await expect(toolbar.getByRole("tab")).toHaveCount(4)
    const title = page.getByTestId("calendar-title")
    const start = (await title.innerText()).trim()
    await page.getByRole("button", { name: "Próximo", exact: true }).click()
    await expect(title).not.toHaveText(start)
    await title.click()
    await expect(title).toHaveText(start)
    await page.getByRole("button", { name: "Próximo", exact: true }).click()
    await page.keyboard.press("t")
    await expect(title).toHaveText(start)
    // Filtros: Listas + Mostrar concluídas, applied to the grid and the rail.
    await page.getByRole("tab", { name: "Mês" }).click()
    const before = await page.locator("[data-agenda-item]").count()
    await page.getByRole("button", { name: /Filtros/ }).click()
    await expect(page.getByText("Listas", { exact: true })).toBeVisible()
    await expect(page.getByText("Mostrar concluídas")).toBeVisible()
    await page.getByRole("checkbox", { name: "A fazer" }).click()
    await expect.poll(() => page.locator("[data-agenda-item]").count()).toBeLessThan(before)
    await expect(page.getByRole("button", { name: /Filtros/ }).locator("[data-slot=badge]")).toBeVisible()
    await context.close()
  })

  test("the header's global 'Nova tarefa' path: the toolbar-less dialog is prefilled by the selected day (button on the board)", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440)
    await open(page)
    await page.getByTestId("day-lists").getByRole("button", { name: "Adicionar tarefa em A fazer" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await context.close()
  })
})

test.describe("7. desktop rail", () => {
  test("three cards; the day card groups by list (no Manhã/Tarde/Noite), concluded and empty lists collapsed; Sem data is its own collapsed card", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440)
    await open(page)
    const rail = page.getByRole("complementary", { name: "Painel do calendário" })
    for (const name of ["A fazer", "Em andamento", "Concluído"]) await expect(rail.getByRole("heading", { name })).toBeVisible()
    await expect(rail.getByText(/^(Manhã|Tarde|Noite|Sem horário)$/)).toHaveCount(0)
    await expect(rail.getByTestId("day-lists").locator("[data-group]").last().locator("button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "false")
    const sem = rail.locator('[data-group="__undated__"] [data-group-header] button[aria-expanded]')
    await expect(sem).toHaveAttribute("aria-expanded", "false")
    await sem.click()
    await expect(rail.getByTestId("undated-tray").locator("[data-task-id]").first()).toBeVisible()
    await context.close()
  })
})

test.describe("8. desktop Lista: one framed card per list", () => {
  test("separate cards with their own border and radius 20, task cards inside, collapse shared with Kanban", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440)
    await open(page, "lista")
    const framed = page.locator("[data-framed]")
    await expect(framed).toHaveCount(3)
    for (const group of await framed.all()) {
      expect(await css(group, "border-top-width")).toBe("1px")
      expect(parseFloat(await css(group, "border-top-left-radius"))).toBe(20)
    }
    const first = framed.first()
    const task = first.locator("[data-task-id]").first()
    expect(await css(task.locator("[data-density=card]"), "border-top-width")).toBe("1px")
    // No shared bordered container with divider rows inside a list card.
    expect(await first.locator("[data-density=row]").count()).toBe(0)
    const gap = (await rect(framed.nth(1))).y - ((await rect(framed.first())).y + (await rect(framed.first())).height)
    expect(Math.round(gap)).toBe(16)
    // Shared collapse state with the Kanban.
    await page.getByRole("button", { name: "Recolher A fazer" }).click()
    await page.getByRole("tab", { name: "Kanban" }).click()
    await expect(page.locator("[data-column]").first()).toHaveAttribute("data-collapsed", "")
    await context.close()
  })
})

test.describe("6. soft scrollbars", () => {
  test("scroll-soft is thin with the webkit rules (no arrow buttons) on the Tarefas scrollers", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440)
    await open(page, "kanban")
    const body = page.locator("[data-list-scroll]").first()
    expect(await css(body, "scrollbar-width")).toBe("thin")
    await expect(page.getByTestId("kanban-board")).toHaveClass(/scroll-soft/)
    const rules = await page.evaluate(() => {
      const text: string[] = []
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) text.push(rule.cssText)
        } catch {}
      }
      return text.join("\n")
    })
    expect(rules).toContain(".scroll-soft::-webkit-scrollbar-thumb")
    expect(rules).toMatch(/\.scroll-soft::-webkit-scrollbar-button[^}]*display:\s*none/)
    await open(page, "agenda")
    await page.getByRole("tab", { name: "Semana" }).click()
    const grid = page.locator("[role=grid] .scroll-soft").first()
    await expect(grid).toBeVisible()
    expect(await css(grid, "scrollbar-width")).toBe("thin")
    await context.close()
  })
})
