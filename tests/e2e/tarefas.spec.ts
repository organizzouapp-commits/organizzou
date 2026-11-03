/**
 * Tarefas redesign, on the development fixture /design-system/tarefas (the real screens on an in-memory API; no database needed).
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test tarefas
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const PREPARAR = "d0000000-0000-4000-8000-000000000010"

async function consent(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
}

async function open(page: Page, path = "/design-system/tarefas") {
  await page.goto(path)
  // CSS selector on purpose: with a pop-up open the page behind is aria-hidden.
  await expect(page.locator('button[aria-label^="Quadro:"]')).toBeVisible({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
}

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
const desktop = { viewport: { width: 1440, height: 900 } }
const card = (page: Page, title: string) => page.locator("[data-task-id]").filter({ hasText: title }).first()

test.describe("desktop", () => {
  test.use(desktop)

  test("default view is Kanban; the last view is remembered per device class and mirrored in the URL", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page)
    await expect(page.locator("[data-column]")).toHaveCount(3)
    await page.getByRole("tab", { name: "Lista" }).click()
    await expect(page).toHaveURL(/view=lista/)
    await page.goto("/design-system/tarefas")
    await expect(page.getByRole("tab", { name: "Lista", selected: true })).toBeVisible({ timeout: 60000 })
    await expect(page.locator("[data-group]").first()).toBeVisible()
  })

  test("toolbar is one row of at most 64 px from 1280; chips show PENDING counts and hide at 0", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, "/design-system/tarefas?view=lista")
    const toolbar = page.getByRole("group", { name: "Atalhos" }).locator("xpath=ancestor::div[contains(@class,'flex-nowrap')][1]")
    expect((await toolbar.boundingBox())!.height).toBeLessThanOrEqual(64)
    const chip = (name: string) => page.getByRole("group", { name: "Atalhos" }).getByRole("button", { name: new RegExp(`^${name}`) })
    await expect(chip("Todas")).toContainText("12")
    await expect(chip("Hoje")).toContainText("2")
    await expect(chip("Atrasadas")).toContainText("2")
    await expect(page.getByText(/\d+ tarefas?$/)).toHaveCount(0)
    // Complete both overdue tasks: the chip disappears (a chip with 0 is hidden) and the total drops.
    for (const title of ["Enviar relatório semanal", "Pagar o IPTU"]) await page.getByRole("checkbox", { name: new RegExp(`Concluir ${title}`) }).click()
    await expect(chip("Atrasadas")).toHaveCount(0)
    await expect(chip("Todas")).toContainText("10")
    await chip("Hoje").click()
    await expect(page).toHaveURL(/atalho=hoje/)
    await expect(chip("Hoje")).toHaveAttribute("aria-pressed", "true")
  })

  test("below 1280 the chips wrap to a second row", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await page.setViewportSize({ width: 1100, height: 900 })
    await open(page, "/design-system/tarefas?view=lista")
    const chips = (await page.getByRole("group", { name: "Atalhos" }).boundingBox())!
    const views = (await page.getByRole("tablist", { name: "Visão" }).boundingBox())!
    expect(chips.y).toBeGreaterThan(views.y + views.height - 1)
  })

  test("card anatomy: no stripe, no signal bars, flag only for high priority, overdue wording", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, "/design-system/tarefas?view=kanban")
    await expect(page.locator('[data-task-id] span.absolute.inset-y-0.left-0')).toHaveCount(0)
    await expect(page.locator("svg.lucide-signal-high, svg.lucide-signal-medium, svg.lucide-signal-low")).toHaveCount(0)
    await expect(page.getByRole("img", { name: "Prioridade alta" })).toHaveCount(4)
    await expect(page.getByText("Urgente")).toHaveCount(0)
    await expect(card(page, "Enviar relatório semanal")).toContainText("atrasada há 1 dia")
    // The due date comes first in the meta line, "Hoje" in a heavier weight than a future date.
    const weight = (text: string) => card(page, "Comprar planta").getByText(text, { exact: true }).evaluate((el) => Number(getComputedStyle(el).fontWeight))
    expect(await weight("Hoje")).toBeGreaterThanOrEqual(600)
  })

  test("complete a task and undo it from the toast", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, "/design-system/tarefas?view=kanban")
    const column = (name: string) => page.locator("[data-column]", { has: page.getByRole("heading", { name, exact: true }) })
    await page.getByRole("checkbox", { name: "Concluir Comprar planta para a sala" }).click()
    await expect(page.getByText("Tarefa concluída.")).toBeVisible()
    await expect(column("Concluído").getByText("Comprar planta para a sala")).toBeVisible()
    await page.getByRole("button", { name: "Desfazer" }).click()
    await expect(column("A fazer").getByText("Comprar planta para a sala")).toBeVisible()
  })

  test("'Mover para…' moves a task to another status without dragging", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, "/design-system/tarefas?view=kanban")
    await card(page, "Comprar planta para a sala").hover()
    // exact: the sortable wrapper (role=button) would also match the name through its content.
    await page.getByRole("button", { name: "Mais ações: Comprar planta para a sala", exact: true }).click()
    await page.getByRole("menuitem", { name: "Mover para…" }).click()
    // Two steps now: quadro first (this fixture has two), then the list.
    await page.getByRole("dialog").getByRole("button", { name: /^Minhas tarefas/ }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Em andamento" }).click()
    await expect(page.locator("[data-column]", { has: page.getByRole("heading", { name: "Em andamento", exact: true }) }).getByText("Comprar planta para a sala")).toBeVisible()
  })

  test("keyboard drag and drop moves a card between columns", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, "/design-system/tarefas?view=kanban")
    const wrapper = card(page, "Organizar o guarda-roupa")
    await wrapper.focus()
    await page.waitForTimeout(500)
    await page.keyboard.press("Space")
    await page.waitForTimeout(400)
    await page.keyboard.press("ArrowRight")
    await page.waitForTimeout(250)
    await page.keyboard.press("ArrowRight")
    await page.waitForTimeout(400)
    await page.keyboard.press("Space")
    await page.waitForTimeout(800)
    await expect
      .poll(() => page.evaluate(() => [...document.querySelectorAll("[data-column]")].map((c) => ({ name: c.querySelector("h3")!.textContent, titles: [...c.querySelectorAll("[data-task-open]")].map((t) => t.textContent ?? "") }))))
      .toEqual(expect.arrayContaining([expect.objectContaining({ name: "Concluído", titles: expect.arrayContaining([expect.stringContaining("Organizar o guarda-roupa")]) })]))
  })

  test("opening a task shows a pop-up over the board WITHOUT moving it; Esc closes and focus returns to the card", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, "/design-system/tarefas?view=kanban")
    const before = await page.locator("[data-column]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)))
    await card(page, "Preparar apresentação").getByRole("button", { name: /Preparar apresentação/ }).first().click({ position: { x: 20, y: 8 } })
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveAttribute("aria-modal", "true").catch(() => {})
    const after = await page.locator("[data-column]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)))
    expect(after).toEqual(before)
    await expect(page).toHaveURL(/tarefa=/)
    const box = (await page.getByRole("dialog").boundingBox())!
    expect(box.width).toBeLessThanOrEqual(760)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest("[data-task-id]")?.getAttribute("data-task-id"))).toBe(PREPARAR)
  })

  test("a direct load of ?tarefa=<id> shows the same board with the task open; Back closes it", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.locator("[data-column]")).toHaveCount(3)
    await expect(page.getByLabel("Título da tarefa")).toHaveValue(/Preparar apresentação/)
    await page.goBack()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("detail: breadcrumb, previous/next, a multi-line title that is never cut, no Repetir control", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, "/design-system/tarefas?view=lista")
    await card(page, "Revisar proposta do cliente").getByRole("button", { name: /Revisar proposta/ }).first().click({ position: { x: 20, y: 8 } })
    await expect(page.getByRole("dialog")).toContainText("Minhas tarefas")
    const title = page.getByLabel("Título da tarefa")
    const fits = await title.evaluate((el) => (el as HTMLTextAreaElement).scrollHeight <= el.clientHeight + 1 && el.clientHeight > 40)
    expect(fits).toBe(true)
    await expect(page.getByText("Repetir")).toHaveCount(0)
    await expect(page.getByText("chegam em breve")).toHaveCount(0)
    const first = await title.inputValue()
    await page.getByRole("button", { name: "Próxima tarefa" }).click()
    await expect(title).not.toHaveValue(first)
    await page.getByRole("button", { name: "Tarefa anterior" }).click()
    await expect(title).toHaveValue(first)
  })

  test("detail: save indicator goes Salvando… -> Salvo; checklist, comments and attachments work", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    const dlg = page.getByRole("dialog")
    await dlg.getByRole("textbox", { name: "Descrição" }).fill("Revisar números antes da reunião")
    await expect(dlg.getByRole("status")).toHaveText(/Salvando…|Salvo/)
    await expect(dlg.getByRole("status")).toHaveText("Salvo")
    // Checklist: add by keyboard, edit in place, Backspace on an empty item deletes it.
    const add = dlg.getByLabel("Adicionar item")
    await add.fill("Conferir gráficos")
    await add.press("Enter")
    await add.fill("Enviar para o time")
    await add.press("Enter")
    await expect(dlg.getByTestId("checklist-row")).toHaveCount(2)
    const first = dlg.getByTestId("checklist-row").first().getByRole("textbox")
    await first.fill("Conferir os gráficos")
    await first.blur()
    await expect(first).toHaveValue("Conferir os gráficos")
    const second = dlg.getByTestId("checklist-row").nth(1).getByRole("textbox")
    await second.fill("")
    await second.press("Backspace")
    await expect(dlg.getByTestId("checklist-row")).toHaveCount(1)
    // Comments: add with the button, delete from the menu.
    await dlg.getByLabel("Novo comentário").fill("Tudo certo por aqui")
    await dlg.getByRole("button", { name: "Comentar" }).click()
    await expect(dlg.getByText("Tudo certo por aqui")).toBeVisible()
    await dlg.getByRole("button", { name: "Mais ações do comentário" }).click()
    await page.getByRole("menuitem", { name: "Excluir" }).click()
    await expect(dlg.getByText("Tudo certo por aqui")).toHaveCount(0)
    // Attachments: a file over 10 MB is rejected with a message, a small one is listed with its size.
    await dlg.getByTestId("attach-input").setInputFiles({ name: "grande.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(11 * 1024 * 1024) })
    await expect(dlg.getByRole("alert")).toContainText("passa de 10 MB")
    await dlg.getByTestId("attach-input").setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("oi") })
    await expect(dlg.getByText("nota.txt")).toBeVisible()
    await expect(dlg.getByText("2 B")).toBeVisible()
  })

  test("detail: properties live in popovers; Excluir tarefa is in the menu and asks to confirm (no undo toast)", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    const dlg = page.getByRole("dialog")
    await dlg.getByRole("button", { name: "Prioridade", exact: true }).click()
    await page.getByRole("button", { name: "Baixa" }).click()
    await expect(dlg.getByRole("button", { name: "Prioridade", exact: true })).toContainText("Baixa")
    await expect(dlg.getByRole("button", { name: "Excluir tarefa" })).toHaveCount(0)
    await dlg.getByRole("button", { name: "Mais ações", exact: true }).click()
    await page.getByRole("menuitem", { name: "Excluir tarefa" }).click()
    await expect(page.getByRole("alertdialog")).toContainText("Excluir esta tarefa?")
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click()
    await expect(page.getByText("Tarefa excluída.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Desfazer" })).toHaveCount(0)
    await expect(card(page, "Preparar apresentação")).toHaveCount(0)
  })

  test("filtered-empty state offers to clear the filters", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, "/design-system/tarefas?view=lista")
    await page.getByRole("button", { name: "Buscar tarefas" }).click()
    await page.getByPlaceholder("Buscar tarefas").fill("zzzz")
    await expect(page.getByText("Nenhuma tarefa com esses filtros")).toBeVisible()
    await page.getByRole("button", { name: "Limpar filtros" }).click()
    await expect(page.locator("[data-group]").first()).toBeVisible()
  })

  test("Lista groups by the quadro's lists; collapse is remembered; the inline composer adds a task", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, "/design-system/tarefas?view=lista")
    const groups = await page.locator("[data-group]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))
    expect(groups).toEqual(["A fazer", "Em andamento", "Concluído"])
    const toggle = page.getByRole("button", { name: "Recolher A fazer" })
    await toggle.click()
    await expect(page.getByRole("button", { name: "Expandir A fazer" })).toHaveAttribute("aria-expanded", "false")
    await page.reload()
    await expect(page.getByRole("button", { name: "Expandir A fazer" })).toBeVisible({ timeout: 60000 })
    await page.getByRole("button", { name: "Expandir A fazer" }).click()
    const group = page.locator('[data-group] >> nth=0')
    await group.getByRole("button", { name: "Adicionar tarefa", exact: true }).click()
    await page.getByLabel("Título da nova tarefa").fill("Revisar contrato")
    await page.getByLabel("Título da nova tarefa").press("Enter")
    await expect(card(page, "Revisar contrato")).toBeVisible()
  })
})

test.describe("phone", () => {
  test.use(phone)

  test("default view is Lista with grouped rows; the title is the list switcher; one Lima + button; no 'N tarefas' text", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page)
    await expect(page.getByRole("tab", { name: "Lista", selected: true })).toBeVisible()
    await expect(page.locator("[data-group]").first()).toBeVisible()
    // The "+" lives in the app header now: the block itself has none.
    await expect(page.getByRole("button", { name: "Nova tarefa" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Buscar tarefas" })).toBeVisible()
    await expect(page.getByRole("button", { name: /^Filtrar e ordenar/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test("Kanban: status tabs follow the swipe between columns; cards are separate; 'Ver mais' after 5", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, "/design-system/tarefas?view=kanban")
    const tabs = page.getByRole("tablist", { name: "Listas do quadro" })
    await expect(tabs.getByRole("tab", { name: /^A fazer/ })).toHaveAttribute("aria-selected", "true")
    expect((await tabs.boundingBox())!.height).toBeGreaterThanOrEqual(47)
    await expect(page.getByRole("button", { name: /Ver mais 4 tarefas/ })).toBeVisible()
    await tabs.getByRole("tab", { name: /^Em andamento/ }).click()
    await expect(tabs.getByRole("tab", { name: /^Em andamento/ })).toHaveAttribute("aria-selected", "true")
    // Swiping the columns moves the active tab (after our own smooth scroll from the tap has finished).
    await page.waitForTimeout(900)
    await page.locator(".snap-mandatory").first().evaluate((el) => el.scrollTo({ left: 2 * (el.clientWidth + 12), behavior: "instant" }))
    await expect(tabs.getByRole("tab", { name: /^Concluído/ })).toHaveAttribute("aria-selected", "true")
  })

  test("swipe left reveals Adiar 1 h / Amanhã / Mover (68 px); swipe right completes", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page)
    const row = page.locator(".touch-pan-y").filter({ hasText: "Ligar para o contador" }).first()
    await row.scrollIntoViewIfNeeded()
    const box = (await row.boundingBox())!
    const fire = (type: string, dx: number) => row.evaluate((el, a) => el.dispatchEvent(new PointerEvent(a.type, { bubbles: true, pointerType: "touch", clientX: a.x, clientY: a.y, isPrimary: true })), { type, x: box.x + box.width - 20 - dx, y: box.y + box.height / 2 })
    await fire("pointerdown", 0)
    for (const dx of [20, 60, 120, 190]) {
      await fire("pointermove", dx)
      await page.waitForTimeout(40)
    }
    await fire("pointerup", 190)
    const panel = page.getByRole("button", { name: /Adiar 1 h/ }).first()
    await expect(panel).toBeVisible()
    expect(Math.round((await panel.boundingBox())!.width)).toBe(68)
    await expect(page.getByRole("button", { name: /^Mover$/ }).first()).toBeVisible()
    await panel.click()
    await expect(page.getByText("Adiado em 1 hora.")).toBeVisible()

    const target = page.locator(".touch-pan-y").filter({ hasText: "Agendar dentista" }).first()
    await target.scrollIntoViewIfNeeded()
    const tb = (await target.boundingBox())!
    const fireR = (type: string, dx: number) => target.evaluate((el, a) => el.dispatchEvent(new PointerEvent(a.type, { bubbles: true, pointerType: "touch", clientX: a.x, clientY: a.y, isPrimary: true })), { type, x: tb.x + 20 + dx, y: tb.y + tb.height / 2 })
    await fireR("pointerdown", 0)
    for (const dx of [20, 60, 100]) {
      await fireR("pointermove", dx)
      await page.waitForTimeout(40)
    }
    await fireR("pointerup", 100)
    await expect(page.getByText("Tarefa concluída.")).toBeVisible()
  })

  test("opening a task shows a bottom sheet: grouped properties open pickers, the sticky button toggles, the title scrolls into the header", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, `/design-system/tarefas?tarefa=${PREPARAR}`)
    const sheet = page.getByRole("dialog")
    await expect(sheet).toBeVisible()
    const box = (await sheet.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(844 * 0.9)
    expect(box.height).toBeLessThanOrEqual(844 * 0.93)
    await expect(sheet.getByTestId("properties").getByRole("button")).toHaveCount(7) // Lista, Quadro, Prioridade, Prazo, Tags, the tag chip ×, Mais opções
    for (const row of await sheet.getByTestId("properties").getByRole("button", { name: /^(Lista|Quadro|Prioridade|Prazo|Tags)$/ }).all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(51)
    await sheet.getByRole("button", { name: "Prioridade", exact: true }).click()
    await page.getByRole("dialog").last().getByRole("button", { name: "Média" }).click()
    await expect(sheet.getByRole("button", { name: "Prioridade", exact: true })).toContainText("Média")
    const complete = sheet.getByRole("button", { name: "Concluir tarefa" })
    const cb = (await complete.boundingBox())!
    expect(cb.height).toBeGreaterThanOrEqual(47)
    await complete.click()
    await expect(sheet.getByRole("button", { name: "Reabrir tarefa" })).toBeVisible()
    await sheet.getByTestId("task-detail-body").evaluate((el) => el.scrollTo({ top: 300 }))
    await expect(sheet.getByTestId("header-title")).toBeVisible()
    await expect(sheet.getByText("Anexar arquivo · até 10 MB")).toBeVisible()
  })

  test("creation sheet: '+' opens it with the title focused", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page, "/design-system/tarefas?view=kanban")
    await page.getByRole("button", { name: "Adicionar tarefa em A fazer" }).click()
    await expect(page.getByRole("dialog")).toContainText("Nova tarefa")
    await expect(page.getByLabel("Título")).toBeFocused()
    await page.getByLabel("Título").fill("Ligar para a escola")
    await page.getByRole("button", { name: "Hoje", exact: true }).click()
    await page.getByRole("button", { name: "Criar tarefa" }).click()
    // The new task is the 10th of "A fazer" (the phone list shows 5), so the toast is the proof.
    await expect(page.getByText("Tarefa criada.")).toBeVisible()
  })

  test("Filtrar e ordenar sheet carries the sort; shortcut chips scroll in Lista", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await open(page)
    await page.getByRole("button", { name: /^Filtrar e ordenar/ }).click()
    await expect(page.getByRole("dialog")).toContainText("Ordem")
    await page.keyboard.press("Escape")
    const chips = page.getByRole("group", { name: "Atalhos" })
    expect((await chips.locator("button").first().boundingBox())!.height).toBeGreaterThanOrEqual(43.5)
  })
})
