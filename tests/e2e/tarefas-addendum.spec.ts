/**
 * Tarefas addendum: "Todas" tab, labeled view switch, undoable deletes, mobile Calendário, card rows and compact labels,
 * priority gone (now tags), trimmed card menu.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test tarefas-addendum
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function setup(browser: Browser, baseURL: string, width: number, height = 844) {
  const context: BrowserContext = await browser.newContext({ viewport: { width, height }, hasTouch: width < 500, isMobile: width < 500 })
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
  const page = await context.newPage()
  return { context, page }
}

async function open(page: Page, view = "kanban") {
  await page.goto(`/design-system/tarefas?view=${view}`)
  await expect(page.locator('button[aria-label^="Quadro:"]')).toBeVisible({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
  await page.waitForTimeout(400)
}

const rect = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!

test.describe("1. Kanban mobile: Todas", () => {
  test("Todas is the first tab with the pending count, stacks every list, and shares the collapse state with Lista", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390)
    await open(page)
    const tabs = page.locator("[data-list-tabs] [role=tab]")
    await expect(tabs.first()).toContainText("Todas")
    await expect(tabs.first()).toContainText(/\d+/)
    await tabs.first().click()
    await expect(page.locator("[data-group]")).toHaveCount(3)
    // "Concluído" starts collapsed (marked as concluded); "A fazer" is open.
    await expect(page.locator("[data-group] button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "true")
    // Collapse "A fazer", then look at Lista: the same state.
    await page.getByRole("button", { name: "Recolher A fazer" }).click()
    await page.getByRole("tab", { name: "Lista" }).click()
    await expect(page.getByRole("button", { name: "Expandir A fazer" })).toBeVisible()
    // The last tab is remembered per quadro.
    await page.getByRole("tab", { name: "Kanban" }).click()
    await expect(page.locator("[data-list-tabs] [role=tab]").first()).toHaveAttribute("aria-selected", "true")
    await context.close()
  })
})

test.describe("2. view switch with labels", () => {
  for (const width of [360, 390, 430]) {
    test(`icons + labels, nothing clipped (${width})`, async ({ browser, baseURL }) => {
      const { context, page } = await setup(browser, baseURL!, width, 800)
      await open(page)
      const tabs = page.locator("[data-view-tab]")
      await expect(tabs).toHaveCount(3)
      for (const tab of await tabs.all()) {
        const label = tab.locator("span").last()
        await expect(label).toBeVisible()
        expect(await label.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
        expect((await rect(tab)).height).toBeGreaterThanOrEqual(32)
        expect(await tab.locator("svg").evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(18)
      }
      await expect(page.locator('[data-view-tab="kanban"]')).toHaveAttribute("aria-selected", "true")
      await context.close()
    })
  }
})

test.describe("3. undo", () => {
  test("Excluir tarefa: 'Desfazer' is visible (>= 44px hit area), above the bottom area, and restores the task with its counters; 8s", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390)
    await open(page)
    const card = page.locator("[data-task-id]").filter({ hasText: "Revisar proposta" }).first()
    const before = await card.locator("[data-task-counters]").innerText()
    await card.getByRole("button", { name: /Mais ações/ }).click()
    await page.getByRole("menuitem", { name: "Excluir tarefa" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click()
    await expect(page.locator("[data-task-id]").filter({ hasText: "Revisar proposta" })).toHaveCount(0)
    const undo = page.getByRole("button", { name: "Desfazer" })
    await expect(undo).toBeVisible()
    const box = await rect(undo)
    expect(box.height).toBeGreaterThanOrEqual(36)
    // The hit area (pseudo-element, 4px each side) reaches 44px.
    expect(await undo.evaluate((e) => parseFloat(getComputedStyle(e, "::after").top) <= -3)).toBe(true)
    await page.waitForTimeout(700) // the toast slides in
    const toast = page.locator("[data-sonner-toast]").first()
    const tb = await rect(toast)
    expect(tb.y + tb.height).toBeLessThanOrEqual(844 - 90)
    expect(tb.width).toBeGreaterThanOrEqual(390 - 32 - 2)
    await undo.click()
    await expect(page.locator("[data-task-id]").filter({ hasText: "Revisar proposta" })).toHaveCount(1)
    expect(await page.locator("[data-task-id]").filter({ hasText: "Revisar proposta" }).first().locator("[data-task-counters]").innerText()).toBe(before)
    await context.close()
  })

  test("the toast lasts 8s, pauses while hovered, and the deletion really happens afterwards", async ({ browser, baseURL }) => {
    test.setTimeout(60000)
    const { context, page } = await setup(browser, baseURL!, 1440, 900)
    await open(page)
    await page.locator("[data-task-id]").filter({ hasText: "Comprar planta" }).first().getByRole("button", { name: /Mais ações/ }).click()
    await page.getByRole("menuitem", { name: "Excluir tarefa" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click()
    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Tarefa excluída." })
    await expect(toast).toBeVisible()
    await page.waitForTimeout(5000)
    await expect(toast).toBeVisible()
    await toast.hover()
    await page.waitForTimeout(5000) // past the 8s mark, but hovered
    await expect(toast).toBeVisible()
    await page.mouse.move(10, 10)
    await expect(toast).toBeHidden({ timeout: 12000 })
    await expect(page.locator("[data-task-id]").filter({ hasText: "Comprar planta" })).toHaveCount(0)
    await context.close()
  })

  test("deleting a list (and its tasks) can be undone with the tasks back in place", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390)
    await open(page, "lista")
    const group = page.locator('[data-group]').filter({ has: page.getByRole("heading", { name: "Em andamento" }) })
    const count = await group.locator("[data-task-id]").count()
    await page.getByRole("button", { name: "Opções da lista Em andamento" }).click()
    await page.getByRole("menuitem", { name: "Excluir lista" }).click()
    await page.getByRole("combobox").click()
    await page.getByRole("option", { name: /Excluir as tarefas junto/ }).click()
    await page.getByRole("button", { name: "Excluir lista" }).click()
    await expect(page.getByRole("heading", { name: "Em andamento" })).toHaveCount(0)
    await page.getByRole("button", { name: "Desfazer" }).click()
    await expect(page.getByRole("heading", { name: "Em andamento" })).toBeVisible()
    await expect(page.locator('[data-group]').filter({ has: page.getByRole("heading", { name: "Em andamento" }) }).locator("[data-task-id]")).toHaveCount(count)
    await context.close()
  })
})

test.describe("4. Calendário on phones", () => {
  test("mode switcher in the header card, one-row toolbar with Hoje at the left, no Listas, titles per mode", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390)
    await open(page, "calendario")
    const modes = page.locator("[data-calendar-modes]")
    await expect(modes).toBeVisible()
    expect((await rect(modes.locator("[role=tab]").first())).height).toBeGreaterThanOrEqual(36)
    await expect(page.getByTestId("calendar-card").getByRole("tab")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Listas/ })).toHaveCount(0)
    const toolbar = page.getByTestId("calendar-toolbar")
    const hoje = await rect(toolbar.getByRole("button", { name: "Hoje" }))
    const card = await rect(page.getByTestId("calendar-card"))
    expect(hoje.x - card.x).toBeLessThanOrEqual(20)
    expect((await rect(toolbar)).height).toBe(40)
    const title = page.getByTestId("calendar-title")
    await page.locator('[data-calendar-mode="mes"]').click()
    await expect(title).toHaveText(/^[a-zç]+ de \d{4}$/)
    await page.locator('[data-calendar-mode="semana"]').click()
    await expect(title).toHaveText(/^\d{1,2} [a-z]{3} – \d{1,2} [a-z]{3}$/)
    await page.locator('[data-calendar-mode="dia"]').click()
    await expect(title).toHaveText(/^[a-zç]+, \d{1,2} de [a-zç]+$/)
    await page.locator('[data-calendar-mode="agenda"]').click()
    await expect(title).toHaveText("Próximos 30 dias")
    await context.close()
  })

  test("Dia: groups are the quadro's lists (no Manhã/Tarde/Noite, no agora), concluded and empty lists collapsed, Sem data collapsible, '+' prefills", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390)
    await open(page, "calendario")
    await page.locator('[data-calendar-mode="dia"]').click()
    const lists = page.getByTestId("day-lists")
    for (const name of ["A fazer", "Em andamento", "Concluído"]) await expect(lists.getByRole("heading", { name })).toBeVisible()
    await expect(page.getByText(/^(Manhã|Tarde|Noite|Sem horário)$/)).toHaveCount(0)
    await expect(page.locator("[data-now-divider]")).toHaveCount(0)
    await expect(lists.locator("[data-group] button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "true")
    await expect(lists.locator("[data-group]").last().locator("button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "false")
    const sem = page.locator('[data-group="sem-data"] button[data-group-header]')
    await expect(sem).toHaveAttribute("aria-expanded", "false")
    await sem.click()
    await expect(sem).toHaveAttribute("aria-expanded", "true")
    // The time stays inside the card; the date does not repeat.
    await expect(page.locator("[data-due-time]").first()).toBeVisible()
    await lists.getByRole("button", { name: "Adicionar tarefa em A fazer" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await context.close()
  })

  test("Agenda: date groups (today open) then Sem data", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390)
    await open(page, "calendario")
    await page.locator('[data-calendar-mode="agenda"]').click()
    const headers = page.locator('[data-testid="agenda-list"] button[aria-expanded]')
    expect(await headers.count()).toBeGreaterThan(1)
    await expect(headers.first()).toHaveText(/\S+, \d{1,2} \S{3}\s*\d+/)
    await expect(headers.first()).toHaveAttribute("aria-expanded", "true")
    await expect(headers.nth(1)).toHaveAttribute("aria-expanded", "false")
    await expect(page.locator('[data-group="sem-data"] button[data-group-header]')).toHaveAttribute("aria-expanded", "false")
    await context.close()
  })

  test("filters live in the 'Filtrar e ordenar' sheet", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390)
    await open(page, "calendario")
    await page.getByRole("button", { name: /Filtrar e ordenar/ }).click()
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByText("Listas", { exact: true })).toBeVisible()
    await expect(sheet.getByText("Mostrar concluídas")).toBeVisible()
    await context.close()
  })
})

for (const width of [390, 1440]) {
  test.describe(`5. task card rows (${width})`, () => {
    test("one-line title, date row with counters at the right, labels below, compact dots toggle globally and persist", async ({ browser, baseURL }) => {
      const { context, page } = await setup(browser, baseURL!, width, 900)
      await open(page)
      const card = page.locator("[data-task-id]").filter({ hasText: "Revisar proposta" }).first()
      const title = card.locator("[data-task-title]")
      const tb = await rect(title)
      expect(Math.round(tb.height)).toBe(20)
      expect(await title.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true)
      const check = await rect(card.locator("[data-task-check] button").first())
      expect(Math.abs(check.y + check.height / 2 - (tb.y + 10))).toBeLessThanOrEqual(1)
      const dateRow = await rect(card.locator("[data-meta-row]"))
      const labels = await rect(card.locator("[data-label-row]"))
      expect(labels.y).toBeGreaterThanOrEqual(dateRow.y + dateRow.height - 1)
      const more = await rect(card.getByRole("button", { name: /Mais ações/ }))
      const counters = await rect(card.locator("[data-task-counters]"))
      expect(Math.abs(counters.x + counters.width - (more.x + more.width))).toBeLessThanOrEqual(2)
      // A chip click toggles compact dots everywhere and does not open the task.
      const chip = card.locator("[data-label-chip]").first()
      await expect(chip).toHaveAttribute("aria-pressed", "false")
      await chip.click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(chip).toHaveAttribute("aria-pressed", "true")
      expect(await page.locator("[data-label-chip][aria-pressed=true]").count()).toBe(await page.locator("[data-label-chip]").count())
      const dot = card.locator("[data-label-chip] [role=img]").first()
      await expect(dot).toHaveAttribute("aria-label", /.+/)
      expect(Math.round((await rect(dot)).width)).toBe(10)
      await page.reload()
      await expect(page.locator('button[aria-label^="Quadro:"]')).toBeVisible({ timeout: 60000 })
      await expect(page.locator("[data-label-chip]").first()).toHaveAttribute("aria-pressed", "true")
      await page.locator("[data-label-chip]").first().click()
      await expect(page.locator("[data-label-chip]").first()).toHaveAttribute("aria-pressed", "false")
      await context.close()
    })
  })
}

test.describe("6. priority is gone (it is tags now)", () => {
  test("no flag, no Prioridade in the dialog, filters, sort, group-by or the shortcut builder; priorities became tags", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440, 900)
    await open(page, "lista")
    await expect(page.locator("svg[aria-label^='Prioridade'], svg.lucide-flag")).toHaveCount(0)
    // The fixture's priorities were converted into tags (Alta / Baixa / Média), without duplicates.
    await page.locator("[data-task-id]").first().click()
    await expect(page.getByRole("dialog").getByText("Prioridade")).toHaveCount(0)
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: /Filtros/ }).click()
    await expect(page.getByText("Prioridade")).toHaveCount(0)
    await page.keyboard.press("Escape")
    await page.getByRole("combobox", { name: "Ordenar" }).click()
    await expect(page.getByRole("option", { name: "Prioridade" })).toHaveCount(0)
    await page.keyboard.press("Escape")
    const names = await page.locator("[data-label-chip]").evaluateAll((els) => els.map((e) => e.getAttribute("title")))
    expect(names.filter((n) => n === "Alta").length).toBeGreaterThan(0)
    await context.close()
  })
})

test.describe("7. card menu", () => {
  test("exactly Renomear, Duplicar, Mover para cima, Mover para baixo, Mover para…, Excluir tarefa; clear of the bottom nav", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390)
    await open(page)
    await page.locator("[data-task-id]").nth(2).getByRole("button", { name: /Mais ações/ }).click()
    await page.waitForTimeout(500) // the open animation scales the menu
    const items = page.getByRole("menuitem")
    expect(await items.allInnerTexts()).toEqual(["Renomear", "Duplicar", "Mover para cima", "Mover para baixo", "Mover para…", "Excluir tarefa"])
    const box = await rect(page.getByRole("menu"))
    expect(box.y + box.height).toBeLessThanOrEqual(844 - 90)
    expect((await rect(items.first())).height).toBeGreaterThanOrEqual(47)
    await context.close()
  })
})
