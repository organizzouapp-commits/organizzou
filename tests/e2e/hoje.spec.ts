/**
 * Customizable "Hoje". Dev server with the login bypass:
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test hoje
 * Phone tests run at 390x844 with touch; desktop tests at 1440x900.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function setup(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
}

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
const desktop = { viewport: { width: 1440, height: 900 } }

/** Opens "Hoje" and waits until the first highlight card has streamed in. */
async function open(page: Page) {
  await page.goto("/dashboard")
  await expect(page.getByRole("link", { name: /^Tarefas de hoje:/ }).first()).toBeVisible({ timeout: 60000 })
}

async function customize(page: Page) {
  await page.getByRole("button", { name: "Personalizar" }).click()
  await expect(page.getByRole("heading", { name: "Destaques" }).last()).toBeVisible()
}

async function waitSaved(page: Page) {
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible({ timeout: 15000 })
}

test.describe("phone (390x844)", () => {
  test.use(phone)

  test("the highlights are a swipeable coverflow with dots, labels and the 3D tween", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const carousel = page.getByRole("region", { name: "Destaques" })
    await expect(carousel).toHaveAttribute("aria-roledescription", "carousel")
    await expect(carousel.getByRole("group", { name: "1 de 4" })).toBeAttached()
    await expect(carousel.getByRole("group", { name: "4 de 4" })).toBeAttached()

    const dots = page.getByRole("tablist", { name: "Escolher destaque" }).getByRole("tab")
    await expect(dots).toHaveCount(4)
    await expect(dots.nth(0)).toHaveAttribute("aria-selected", "true")

    // The active slide is flat; its neighbours are turned, smaller and fainter (transform and opacity only).
    const inner = (n: number) => carousel.getByRole("group").nth(n).locator("> div").first()
    await expect.poll(async () => inner(1).evaluate((el) => (el as HTMLElement).style.transform)).toContain("rotateY")
    expect(await inner(1).evaluate((el) => Number((el as HTMLElement).style.opacity))).toBeLessThan(0.9)
    expect(await inner(0).evaluate((el) => Number((el as HTMLElement).style.opacity))).toBe(1)

    // Swipe left: the next card becomes active.
    const box = (await carousel.boundingBox())!
    const y = box.y + box.height / 2
    await page.mouse.move(box.x + box.width * 0.7, y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.2, y, { steps: 12 })
    await page.mouse.up()
    await expect(dots.nth(1)).toHaveAttribute("aria-selected", "true")

    // Keyboard arrows move it too, and the dots jump.
    await carousel.focus()
    await page.keyboard.press("ArrowRight")
    await expect(dots.nth(2)).toHaveAttribute("aria-selected", "true")
    await dots.nth(0).click()
    await expect(dots.nth(0)).toHaveAttribute("aria-selected", "true")
  })

  test("vertical page scroll still works over the carousel", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const scroller = page.locator("[data-app-scroll]")
    const carousel = page.getByRole("region", { name: "Destaques" })
    const box = (await carousel.boundingBox())!
    const before = await scroller.evaluate((el) => el.scrollTop + window.scrollY)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 400)
    await expect.poll(async () => scroller.evaluate((el) => el.scrollTop + window.scrollY)).toBeGreaterThan(before)
  })

  test("prefers-reduced-motion renders the flat carousel: no 3D, no loop", async ({ page, context, baseURL }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await setup(context, baseURL!)
    await open(page)
    const carousel = page.getByRole("region", { name: "Destaques" })
    for (const n of [0, 1, 2, 3]) {
      const style = await carousel.getByRole("group").nth(n).locator("> div").first().evaluate((el) => ({ transform: (el as HTMLElement).style.transform, opacity: (el as HTMLElement).style.opacity }))
      expect(style).toEqual({ transform: "", opacity: "" })
    }
  })

  test("0 tasks never shows 100%: postponing everything leaves no bar and an honest line", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const card = page.getByRole("link", { name: /^Tarefas de hoje:/ }).first()
    await expect(card).toContainText("0 de 4 concluídas")
    const rows = page.locator('[data-testid="seu-dia-list"] [data-kind="task"]:not([data-done])')
    for (let guard = 0; guard < 8 && (await rows.count()) > 0; guard++) {
      await rows.first().click({ button: "right" })
      await page.getByRole("menuitem", { name: "Adiar para amanhã" }).click()
    }
    await expect(card).toContainText("Nenhuma tarefa para hoje")
    await expect(card).not.toContainText("100%")
    await expect(card.getByRole("progressbar")).toHaveCount(0)
  })
})

test.describe("desktop (1440x900)", () => {
  test.use(desktop)

  test("highlights are 4 across and the side column holds the panels", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const cards = page.getByRole("link", { name: /^(Tarefas de hoje|Hábitos de hoje|Gasto de hoje|Água):/ })
    await expect(cards).toHaveCount(4)
    const boxes = await Promise.all((await cards.all()).map((c) => c.boundingBox()))
    expect(new Set(boxes.map((b) => Math.round(b!.y))).size).toBe(1)
    expect(new Set(boxes.map((b) => Math.round(b!.height))).size).toBe(1)
    const main = (await page.locator('[data-panel="seu-dia"]').boundingBox())!
    const aside = (await page.locator('[data-panel="notas"]').boundingBox())!
    expect(aside.x).toBeGreaterThan(main.x + main.width - 1)
  })

  test("change the highlights and the panel order: both survive a reload", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    await customize(page)

    // 4 are chosen: picking a 5th asks which one to replace.
    await page.getByRole("button", { name: "Adicionar Sobra do mês aos destaques" }).click()
    const ask = page.getByRole("group", { name: "Qual destaque substituir?" })
    await expect(ask).toBeVisible()
    await ask.getByRole("button", { name: /Água/ }).click()
    await expect(page.getByRole("button", { name: "Sobra do mês: destaque 4" })).toBeVisible()

    // Reorder with the up/down alternative to dragging.
    await page.getByRole("button", { name: "Mover Finanças para cima" }).click()
    await page.getByRole("button", { name: "Mover Finanças para cima" }).click()
    await waitSaved(page)
    await page.getByRole("button", { name: "Pronto" }).click()

    await page.reload()
    await expect(page.getByRole("link", { name: /^Sobra do mês:/ }).first()).toBeVisible({ timeout: 60000 })
    await expect(page.getByRole("link", { name: /^Água:/ })).toHaveCount(0)
    const order = await page.locator("[data-panel]").evaluateAll((els) => els.map((el) => el.getAttribute("data-panel")))
    expect(order.indexOf("financas")).toBeLessThan(order.indexOf("notas"))
  })

  test("hide and show Notas e lembretes; it can be hidden and brought back, and everything hidden shows the empty state", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    await expect(page.locator('[data-panel="notas"]')).toBeVisible()
    await customize(page)
    await page.getByRole("switch", { name: "Esconder Notas e lembretes" }).click()
    await expect(page.locator('[data-panel="notas"]')).toHaveCount(0)
    await waitSaved(page)
    await page.getByRole("button", { name: "Pronto" }).click()
    await page.reload()
    await expect(page.getByRole("link", { name: /^Tarefas de hoje:/ }).first()).toBeVisible({ timeout: 60000 })
    await expect(page.locator('[data-panel="notas"]')).toHaveCount(0)

    await customize(page)
    await page.getByRole("switch", { name: "Mostrar Notas e lembretes" }).click()
    await expect(page.locator('[data-panel="notas"]')).toBeVisible({ timeout: 30000 })

    // Hide every panel: an empty state with a way back.
    for (const name of ["Seu dia", "Notas e lembretes", "Finanças", "Dieta e água", "Treino", "Estudos", "Como você está?"]) {
      await page.getByRole("switch", { name: `Esconder ${name}` }).click()
    }
    await page.getByRole("button", { name: "Pronto" }).click()
    await expect(page.getByText("Nenhum painel por aqui")).toBeVisible()
    await expect(page.getByRole("button", { name: "Personalizar" }).last()).toBeVisible()
  })

  test("Restaurar padrão asks first, then restores", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    await customize(page)
    await page.getByRole("switch", { name: "Esconder Finanças" }).click()
    await expect(page.locator('[data-panel="financas"]')).toHaveCount(0)
    await page.getByRole("button", { name: "Restaurar padrão" }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await page.getByRole("button", { name: "Restaurar", exact: true }).click()
    await expect(page.locator('[data-panel="financas"]')).toBeVisible()
  })

  test("complete an item in Seu dia, watch the card follow, then undo", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const habits = page.getByRole("link", { name: /^Hábitos de hoje:/ }).first()
    await expect(habits).toContainText("1/5")
    const box = page.getByRole("checkbox", { name: "Concluir Treinar" })
    await box.click()
    await expect(habits).toContainText("2/5")
    await expect(page.getByText("Concluído.", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Desfazer" }).click()
    await expect(habits).toContainText("1/5")
    await expect(page.getByRole("checkbox", { name: "Concluir Treinar" })).not.toBeChecked()
  })

  test("a quantity habit has a + button; filters narrow the list; Concluídos is collapsed", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    await expect(page.getByRole("button", { name: /Adicionar .* a Ler 20 páginas/ })).toBeVisible()
    const filters = page.getByRole("group", { name: "Filtrar o dia" })
    await filters.getByRole("button", { name: "Finanças", exact: true }).click()
    await expect(page.locator('[data-testid="seu-dia-list"] [data-kind="habit"]')).toHaveCount(0)
    await filters.getByRole("button", { name: "Tudo", exact: true }).click()
    await expect(page.getByRole("button", { name: /Concluídos \(\d+\)/ })).toHaveAttribute("aria-expanded", "false")
  })

  test("a reminder can be marked done from its menu, and a quick note is created with Enter", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const notes = page.locator('[data-panel="notas"]')
    await expect(notes.getByText("Em breve")).toBeVisible()
    await notes.getByRole("button", { name: /^Ações do lembrete/ }).first().click()
    await page.getByRole("menuitem", { name: "Feito" }).click()
    await expect(page.getByText("Lembrete concluído.")).toBeVisible()
    await notes.getByLabel("Nota rápida").fill("Comprar pilhas")
    await notes.getByLabel("Nota rápida").press("Enter")
    await expect(notes.getByText("Comprar pilhas")).toBeVisible()
  })
})

test("the assistant insight line is gone", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!)
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page)
  await expect(page.getByText(/12% menos com restaurantes/)).toHaveCount(0)
  await expect(page.getByText(/Insight · toque para conversar/)).toHaveCount(0)
})
