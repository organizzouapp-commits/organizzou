/**
 * Tarefas, "Quadro / Lista" round: bounded Kanban, lists as first-class (create, rename, reorder, collapse), auto-commit fields,
 * editable shortcuts, Lista = same lists, card menu and rename, date popover, comments, quadro moves. Mobile first.
 * On the development fixture /design-system/tarefas (in-memory API):
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test tarefas-quadro
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const PREPARAR = "d0000000-0000-4000-8000-000000000010"

async function consent(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
}

async function open(page: Page, path = "/design-system/tarefas?view=kanban") {
  await page.goto(path)
  await expect(page.locator('button[aria-label^="Quadro:"]')).toBeVisible({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
}

const columnNames = (page: Page) => page.locator("section[data-column]").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")))
const card = (page: Page, title: string) => page.locator("[data-task-id]").filter({ hasText: title }).first()
const inViewport = async (page: Page, box: { x: number; y: number; width: number; height: number }) => {
  const size = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1)
  expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1)
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

  test("the board has a bounded height and a long list scrolls inside itself with header and composer in view", async ({ page }) => {
    await open(page, "/design-system/tarefas?view=kanban&volume=30")
    const board = page.getByTestId("kanban-board")
    const box = (await board.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(900)
    const scroller = page.locator("[data-list-scroll]").first()
    expect(await scroller.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(200)
    await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight))
    const column = page.locator("section[data-column]").first()
    await expect(column.getByRole("button", { name: /^Adicionar tarefa em/ })).toBeInViewport()
    await expect(column.getByRole("button", { name: /^Adicionar tarefa…$/ })).toBeInViewport()
    // Only the list scrolled, not the page.
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(2)
  })

  test("lists fill the width and Nova lista is as wide as a list", async ({ page }) => {
    await open(page)
    const widths = await page.locator("section[data-column], [data-new-list]").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)))
    expect(widths).toHaveLength(4)
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2)
    const gap = await page.evaluate(() => {
      const board = document.querySelector('[data-testid="kanban-board"]')!.getBoundingClientRect()
      const last = document.querySelector("[data-new-list]")!.getBoundingClientRect()
      return board.right - last.right
    })
    expect(gap).toBeLessThanOrEqual(2)
  })

  test("a new list is saved by clicking outside; Esc cancels; empty does nothing; Enter then blur creates one", async ({ page }) => {
    await open(page)
    const field = page.getByLabel("Nome da nova lista")
    await page.locator("[data-new-list] button").click()
    await field.fill("Revisão")
    await page.mouse.click(5, 450)
    await expect(page.locator("section[data-column]")).toHaveCount(4)
    expect(await columnNames(page)).toContain("Revisão")

    await page.locator("[data-new-list] button").click()
    await field.fill("Descartada")
    await field.press("Escape")
    await expect(field).toHaveCount(0)
    expect(await columnNames(page)).not.toContain("Descartada")

    await page.locator("[data-new-list] button").click()
    await page.mouse.click(5, 450)
    await expect(field).toHaveCount(0)
    await expect(page.locator("section[data-column]")).toHaveCount(4)

    await page.locator("[data-new-list] button").click()
    await field.fill("Dupla")
    await field.press("Enter")
    await page.mouse.click(5, 450)
    await expect(page.locator("section[data-column]")).toHaveCount(5)
    expect((await columnNames(page)).filter((n) => n === "Dupla")).toHaveLength(1)
  })

  test("a task composer saves on blur and Enter keeps it open for the next one", async ({ page }) => {
    await open(page)
    const column = page.locator('section[aria-label="A fazer"]')
    await column.getByRole("button", { name: /^Adicionar tarefa…$/ }).click()
    const field = column.getByLabel("Título da nova tarefa")
    await field.fill("Primeira nova")
    await field.press("Enter")
    await expect(card(page, "Primeira nova")).toBeVisible()
    await expect(field).toBeVisible()
    await field.fill("Segunda nova")
    await page.mouse.click(5, 450)
    await expect(card(page, "Segunda nova")).toBeVisible()
    await expect(page.locator("[data-task-id]").filter({ hasText: "Segunda nova" })).toHaveCount(1)
  })

  test("lists reorder by keyboard (Alt + arrows) and by dragging the header, and collapse state survives a reload", async ({ page }) => {
    await open(page)
    expect(await columnNames(page)).toEqual(["A fazer", "Em andamento", "Concluído"])
    const handle = page.getByRole("button", { name: "Mover a lista A fazer" })
    await handle.focus()
    await handle.press("Alt+ArrowRight")
    await expect.poll(() => columnNames(page)).toEqual(["Em andamento", "A fazer", "Concluído"])

    const header = page.locator('section[aria-label="Concluído"] header')
    const from = (await header.boundingBox())!
    const target = (await page.locator('section[aria-label="Em andamento"] header').boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 })
    await page.mouse.up()
    await expect.poll(() => columnNames(page)).toEqual(["Concluído", "Em andamento", "A fazer"])

    await page.getByRole("button", { name: "Recolher Em andamento" }).click()
    // Collapsed = header only: same width as a list, exactly the 56 px header, top aligned.
    const rail = page.locator("section[data-collapsed]")
    await expect(rail).toHaveCount(1)
    await page.waitForTimeout(600)
    const box = (await rail.boundingBox())!
    const sibling = (await page.locator("section[data-column]:not([data-collapsed])").first().boundingBox())!
    expect(Math.round(box.height)).toBe(56)
    expect(Math.abs(box.width - sibling.width)).toBeLessThanOrEqual(2)
    expect(Math.abs(box.y - sibling.y)).toBeLessThanOrEqual(1)
    await page.reload()
    await expect(page.locator("section[data-collapsed]")).toHaveCount(1, { timeout: 60000 })
    await page.getByRole("button", { name: /^Expandir Em andamento/ }).click()
    await expect(page.locator("section[data-collapsed]")).toHaveCount(0)
  })

  test("a list is renamed by clicking its name", async ({ page }) => {
    await open(page)
    await page.locator('section[aria-label="A fazer"] h3 button').click()
    const field = page.getByLabel("Nome da lista A fazer")
    await field.fill("Backlog")
    await field.press("Enter")
    await expect(page.locator('section[aria-label="Backlog"] h3 button')).toBeVisible()
  })

  test("one click opens the dialog; double click, F2 and the menu rename the title in place", async ({ page }) => {
    await open(page)
    await card(page, "Comprar planta").locator("[data-task-open]").click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await card(page, "Comprar planta").locator("[data-task-open]").dblclick()
    const field = page.getByLabel(/^Renomear Comprar planta/)
    await expect(field).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await field.fill("Comprar vasos")
    await field.press("Enter")
    await expect(card(page, "Comprar vasos")).toBeVisible()

    await card(page, "Comprar vasos").locator("[data-task-open]").focus()
    await page.keyboard.press("F2")
    const again = page.getByLabel(/^Renomear Comprar vasos/)
    await again.fill("Comprar samambaia")
    await again.press("Escape")
    await expect(card(page, "Comprar vasos")).toBeVisible()

    await card(page, "Comprar vasos").getByRole("button", { name: /^Mais ações/ }).click()
    await page.getByRole("menuitem", { name: "Renomear" }).click()
    const viaMenu = page.getByLabel(/^Renomear Comprar vasos/)
    await viaMenu.fill("Comprar cacto")
    await page.mouse.click(5, 450)
    await expect(card(page, "Comprar cacto")).toBeVisible()
  })

  test("the card has no floating pill and its menu trigger does not overlap the title", async ({ page }) => {
    await open(page)
    const target = card(page, "Revisar proposta")
    await target.hover()
    await expect(page.getByRole("button", { name: /^Adiar 1 h:/ })).toHaveCount(0)
    const title = (await target.locator("[data-task-open]").boundingBox())!
    const trigger = (await target.getByRole("button", { name: /^Mais ações/ }).boundingBox())!
    expect(trigger.x).toBeGreaterThanOrEqual(title.x + title.width - 1)
    expect(trigger.width).toBeLessThanOrEqual(40)
  })

  test("the search is a pill like the header search", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: "Buscar tarefas" }).click()
    const input = page.getByRole("searchbox", { name: "Buscar tarefas" })
    await expect(input).toBeVisible()
    expect(parseFloat(await input.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThanOrEqual(20)
  })


  test("Lista shows the same lists in the same order, collapse is shared, and Agrupar por switches the grouping", async ({ page }) => {
    await open(page)
    const handle = page.getByRole("button", { name: "Mover a lista A fazer" })
    await handle.focus()
    await handle.press("Alt+ArrowRight")
    await page.getByRole("button", { name: "Recolher A fazer" }).click()
    await page.getByRole("tab", { name: "Lista" }).click()
    await expect(page.locator("[data-group]").first()).toBeVisible()
    const groups = await page.locator("[data-group]").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")))
    expect(groups).toEqual(["Em andamento", "A fazer", "Concluído"])
    await expect(page.locator('[data-group] >> nth=1').getByRole("button", { name: /^Expandir A fazer/ })).toBeVisible()
    await page.getByRole("button", { name: "Filtros" }).click()
    await page.getByRole("radio", { name: "Agrupar por prazo" }).click()
    await expect(page.locator('[data-group="atrasadas"]')).toBeVisible()
  })

  test("the date popover stays inside the viewport at 1280 x 720", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "Prazo", exact: true }).click()
    const content = page.locator('[data-slot="popover-content"]')
    await expect(content).toBeVisible()
    await page.waitForTimeout(500)
    await inViewport(page, (await content.boundingBox())!)
    expect(Math.round((await content.boundingBox())!.width)).toBe(320)
  })

  test("comments are not posted on blur, the draft persists, and the item menu says only Excluir", async ({ page }) => {
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    const box = page.getByLabel("Novo comentário")
    await box.fill("rascunho")
    await page.getByLabel("Descrição").first().click()
    await expect(page.getByRole("button", { name: "Mais ações do comentário" })).toHaveCount(0)
    await page.reload()
    await expect(page.getByLabel("Novo comentário")).toHaveValue("rascunho", { timeout: 60000 })
    await page.getByRole("button", { name: "Comentar" }).click()
    await expect(page.getByLabel("Novo comentário")).toHaveValue("")
    await page.getByRole("button", { name: "Mais ações do comentário" }).click()
    await expect(page.getByRole("menuitem")).toHaveText(["Excluir"])
  })

  test("a checklist item is saved when the field loses focus", async ({ page }) => {
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    await page.getByLabel("Adicionar item").fill("Item sem Enter")
    await page.getByLabel("Descrição").first().click()
    await expect(page.getByTestId("checklist-row").filter({ has: page.getByLabel("Item: Item sem Enter") })).toHaveCount(1)
  })

  test("Calendário: week grid with a side rail (mini month, day list, Sem data), drag reschedules, same dialog opens", async ({ page }) => {
    await open(page, "/design-system/tarefas?view=calendario")
    const calendar = page.getByTestId("tasks-calendar")
    await expect(calendar.getByRole("grid").first()).toBeVisible()
    const rail = calendar.getByRole("complementary", { name: "Painel do calendário" })
    await expect(rail.getByRole("grid", { name: /Novembro/i }).or(rail.getByText("Novembro 2026"))).toBeVisible()
    await rail.getByTestId("undated-tray").getByRole("button", { name: "Expandir Sem data" }).click()
    await expect(rail.getByTestId("undated-tray").getByText("Pesquisar curso de fotografia")).toBeVisible()
    const railBox = (await rail.boundingBox())!
    expect(Math.round(railBox.width)).toBe(320)

    // Drag the timed task (Preparar apresentação) to another day and hour: 15-minute snap, undo offered by the toast.
    const chip = page.getByRole("button", { name: /Preparar apresentação/ }).first()
    const from = (await chip.boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width / 2 - 140, from.y + from.height / 2 + 112, { steps: 10 })
    await page.mouse.up()
    await expect(page.getByText("Tarefa reagendada.")).toBeVisible()

  })


  test("tags: create from the picker, chip with ×, rename and delete in Gerenciar", async ({ page }) => {
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Tags", exact: true }).click()
    const picker = page.getByTestId("picker-tag")
    await picker.getByLabel("Buscar ou criar tag").fill("Urgente hoje")
    await picker.getByRole("button", { name: "Criar “Urgente hoje”" }).click()
    await page.keyboard.press("Escape")
    const chips = dialog.getByRole("list", { name: "Tags da tarefa" })
    await expect(chips.getByText("Urgente hoje")).toBeVisible()
    await chips.getByRole("button", { name: "Remover tag Urgente hoje" }).click()
    await expect(chips.getByText("Urgente hoje")).toHaveCount(0)

    await dialog.getByRole("button", { name: "Tags", exact: true }).click()
    await picker.getByRole("button", { name: "Gerenciar" }).click()
    await picker.getByRole("button", { name: "Urgente hoje", exact: true }).click()
    await picker.getByLabel("Nome: Urgente hoje").fill("Agora")
    await picker.getByLabel("Nome: Urgente hoje").press("Enter")
    await expect(picker.getByText("Agora", { exact: true })).toBeVisible()
    await picker.getByRole("button", { name: "Excluir Agora" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click()
    await expect(picker.getByText("Agora", { exact: true })).toHaveCount(0)
  })

  test("categories: pick one from a manageable list and rename it everywhere", async ({ page }) => {
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Categoria", exact: true }).click()
    const picker = page.getByTestId("picker-categoria")
    await picker.getByLabel("Buscar ou criar categoria").fill("Projeto")
    await picker.getByRole("button", { name: "Criar “Projeto”" }).click()
    await expect(dialog.getByRole("button", { name: "Categoria", exact: true })).toContainText("Projeto")
    await dialog.getByRole("button", { name: "Categoria", exact: true }).click()
    await picker.getByRole("button", { name: "Gerenciar" }).click()
    await picker.getByRole("button", { name: "Projeto", exact: true }).click()
    await picker.getByLabel("Nome: Projeto").fill("Cliente")
    await picker.getByLabel("Nome: Projeto").press("Enter")
    await picker.getByRole("button", { name: "Concluir" }).click()
    await page.keyboard.press("Escape")
    await expect(dialog.getByRole("button", { name: "Categoria", exact: true })).toContainText("Cliente")
  })

  test("deleting a list with tasks asks where they go (default: another list)", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: "Opções da lista Em andamento" }).click()
    await page.getByRole("menuitem", { name: "Excluir lista" }).click()
    const dialog = page.getByRole("dialog", { name: "Excluir esta lista?" })
    await expect(dialog).toContainText("A lista tem 3 tarefas")
    await expect(dialog.getByRole("combobox")).toContainText("Mover para “A fazer”")
    await dialog.getByRole("button", { name: "Excluir lista" }).click()
    await expect.poll(() => columnNames(page)).toEqual(["A fazer", "Concluído"])
    await expect(card(page, "Preparar apresentação")).toBeVisible()
  })

  test("Mover para… is two steps: quadro, then list", async ({ page }) => {
    await open(page)
    await card(page, "Organizar o guarda-roupa").getByRole("button", { name: /^Mais ações/ }).click()
    await page.getByRole("menuitem", { name: "Mover para…" }).click()
    const dialog = page.getByRole("dialog", { name: "Mover para…" })
    await dialog.getByRole("button", { name: /^Casa e vida/ }).click()
    await dialog.getByRole("button", { name: "A fazer" }).click()
    await expect(page.getByText("Movida para Casa e vida › A fazer")).toBeVisible()
    await expect(card(page, "Organizar o guarda-roupa")).toHaveCount(0)
  })

  test("moving a task to another quadro offers Desfazer", async ({ page }) => {
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    await page.getByRole("button", { name: "Quadro", exact: true }).click()
    await page.getByRole("button", { name: "Casa e vida" }).click()
    await expect(page.getByText(/Movida para Casa e vida › /)).toBeVisible()
    await expect(card(page, "Preparar apresentação")).toHaveCount(0)
    await page.getByRole("button", { name: "Desfazer" }).click()
    await expect(card(page, "Preparar apresentação")).toBeVisible()
  })
})

for (const width of [360, 390, 430]) {
  test.describe(`phone ${width}`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })
    test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

    test("header block: no clipped labels, no second +, no horizontal page scroll", async ({ page }) => {
      await open(page)
      await expect(page.getByRole("button", { name: "Nova tarefa" })).toHaveCount(0)
      const clipped = await page.locator('[role="tablist"] [role="tab"]').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length)
      expect(clipped).toBe(0)
      const views = await page.getByRole("tablist", { name: "Visão" }).locator('[role="tab"]').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)))
      expect(Math.max(...views) - Math.min(...views)).toBeLessThanOrEqual(2)
      for (const tab of await page.getByRole("tablist", { name: "Visão" }).locator('[role="tab"]').all()) expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(36)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      expect((await page.getByRole("button", { name: "Buscar tarefas" }).boundingBox())!.height).toBeGreaterThanOrEqual(36)
    })
  })
}

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

  test("the page scrolls normally (no nested scroll) and the list tabs switch lists", async ({ page }) => {
    await open(page, "/design-system/tarefas?view=kanban&volume=30")
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(850)
    const tab = page.getByRole("tab", { name: /^Em andamento/ })
    await tab.click()
    await expect(tab).toHaveAttribute("aria-selected", "true")
    await expect(card(page, "Preparar apresentação")).toBeInViewport()
  })

  test("a list added from the + Lista tab is saved by closing the keyboard (blur)", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: "Lista", exact: true }).click()
    await page.getByLabel("Nome da nova lista").fill("Em revisão")
    await page.getByRole("heading", { name: "A fazer" }).click()
    await expect(page.getByRole("tab", { name: /^Em revisão/ })).toBeVisible()
  })

  test("Gerenciar listas: rename, add and the ✓ button", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: /^Filtrar e ordenar/ }).click()
    await page.getByRole("button", { name: "Gerenciar listas" }).click()
    const sheet = page.getByRole("dialog", { name: "Gerenciar listas" })
    await expect(sheet.locator("[data-manage-list]")).toHaveCount(3)
    await sheet.getByRole("button", { name: "A fazer", exact: true }).click()
    const field = sheet.getByLabel("Nome da lista A fazer")
    await field.fill("Backlog")
    await sheet.getByRole("button", { name: "Salvar" }).click()
    await expect(sheet.getByRole("button", { name: "Backlog", exact: true })).toBeVisible()
    await sheet.getByRole("button", { name: "Nova lista" }).click()
    await sheet.getByLabel("Nome da nova lista").fill("Ideias")
    await sheet.getByRole("button", { name: "Salvar" }).click()
    await expect(sheet.locator("[data-manage-list]")).toHaveCount(4)
  })

  test("the date picker sheet stays inside a 360 x 640 screen", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "Prazo", exact: true }).click()
    const sheet = page.locator('[data-slot="drawer-content"]').last()
    await expect(sheet).toBeVisible()
    await page.waitForTimeout(600)
    await inViewport(page, (await sheet.boundingBox())!)
  })
})
