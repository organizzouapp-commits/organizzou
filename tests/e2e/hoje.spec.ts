/**
 * "Hoje" v2. Dev server with the login bypass:
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test hoje
 * Phone tests run at 390x844 with touch; desktop tests at 1440x900.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const SIDEBAR_COOKIE = "sidebar_state_00000000000040008000000000000001"

async function setup(context: BrowserContext, baseURL: string, sidebarOpen = true) {
  await context.addCookies([
    { name: "organizzou_consent", value: CONSENT, url: baseURL },
    { name: SIDEBAR_COOKIE, value: String(sidebarOpen), url: baseURL },
  ])
}

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
const desktop = { viewport: { width: 1440, height: 900 } }

/** Opens "Hoje" and waits for the page content, then for React streaming to settle (typing before the swap lands in a discarded node). */
async function open(page: Page) {
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "Seu dia" }).first()).toBeVisible({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
}

/** The saved layout, as the server reads it back (the `hoje_prefs` cookie mirrors every save). */
async function savedPrefs(context: BrowserContext) {
  const cookie = (await context.cookies()).find((c) => c.name === "hoje_prefs")
  return cookie ? JSON.parse(decodeURIComponent(cookie.value)) : null
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const waitSaved = (context: BrowserContext, ok: (prefs: any) => boolean) => expect.poll(async () => ok(await savedPrefs(context)), { timeout: 15000 }).toBe(true)

const deskCards = (page: Page) => page.locator('[data-slot="carousel"] [data-slot="carousel-item"] a[aria-label*=": "]')

async function customize(page: Page) {
  await page.getByRole("button", { name: "Personalizar" }).click()
  await expect(page.getByRole("heading", { name: "Destaques" }).last()).toBeVisible()
}

test.describe("phone (390x844)", () => {
  test.use(phone)

  test("the highlights are a stacked-cards deck: swipe moves to the next card, with a counter and at most 7 dots", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const deck = page.locator(".swiper").first()
    await expect(deck).toBeVisible()
    await expect(page.getByText("1 de 16", { exact: true })).toBeVisible()
    await expect(page.getByRole("tablist", { name: "Escolher destaque" }).getByRole("tab")).toHaveCount(7)

    const box = (await deck.boundingBox())!
    const y = box.y + box.height / 2
    await page.mouse.move(box.x + box.width * 0.8, y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.1, y, { steps: 12 })
    await page.mouse.up()
    await expect(page.getByText("2 de 16", { exact: true })).toBeVisible()

    // The dots jump, and vertical scrolling is left to the page (the deck only takes horizontal pans).
    await page.getByRole("tab", { name: "Destaque 1 de 16" }).click()
    await expect(page.getByText("1 de 16", { exact: true })).toBeVisible()
    expect(await deck.evaluate((el) => getComputedStyle(el).touchAction)).toContain("pan-y")
  })

  test("prefers-reduced-motion renders the flat strip: no stacked deck", async ({ page, context, baseURL }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await setup(context, baseURL!)
    await open(page)
    await expect(page.locator(".swiper")).toHaveCount(0)
    const strip = page.locator('[aria-roledescription="carousel"]').first()
    await expect(strip).toBeVisible()
    expect(await strip.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto")
    await expect(strip.getByRole("group", { name: "16 de 16" })).toBeAttached()
  })

  test("the panels are folded cards with a summary; unfolding one is remembered", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const finance = page.locator('[data-panel="financas"]')
    const toggle = finance.getByRole("button", { expanded: false })
    await expect(toggle).toContainText("Sobra do mês")
    await toggle.click()
    await expect(finance.getByRole("button", { expanded: true })).toBeVisible()
    await waitSaved(context, (p) => p?.expandedPanels?.includes("financas"))
    await page.reload()
    await expect(page.locator('[data-panel="financas"]').getByRole("button", { expanded: true })).toBeVisible({ timeout: 60000 })
  })

  test("rows keep a 64 px height and the page never scrolls sideways", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const rows = page.locator('[data-testid="seu-dia-list"] [data-kind]')
    await expect(rows.first()).toBeVisible()
    for (const row of (await rows.all()).slice(0, 4)) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(63)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })

  test("0 tasks never shows 100%: postponing everything leaves no bar and an honest line", async ({ page, context, baseURL }) => {
    // A tall phone: every row is on screen and the menu has room, clear of the floating pill (a real person long-presses a row they can see).
    await page.setViewportSize({ width: 390, height: 1500 })
    await setup(context, baseURL!)
    await open(page)
    // Phones show the highlights as a deck: the Tarefas card is the first (active) one.
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

  test("a new person sees every highlight enabled, in one row with arrows and equal heights", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    await expect(page.locator('[data-slot="carousel"] [data-slot="carousel-item"]')).toHaveCount(16)
    const first = await deskCards(page).first().boundingBox()
    expect(first!.width).toBeGreaterThanOrEqual(240)
    expect(first!.width).toBeLessThanOrEqual(320)
    const boxes = await Promise.all((await deskCards(page).all()).slice(0, 4).map((c) => c.boundingBox()))
    expect(new Set(boxes.map((b) => Math.round(b!.y))).size).toBe(1)
    expect(new Set(boxes.map((b) => Math.round(b!.height))).size).toBe(1)

    // Arrows sit in the DESTAQUES row, and "next" really scrolls the row.
    const label = (await page.getByRole("heading", { name: "Destaques", level: 2 }).boundingBox())!
    const next = page.getByRole("button", { name: "Próximos destaques" })
    await expect(next).toBeVisible()
    const nb = (await next.boundingBox())!
    expect(Math.abs(nb.y + nb.height / 2 - (label.y + label.height / 2))).toBeLessThan(12)
    const before = (await deskCards(page).first().boundingBox())!.x
    await next.click()
    await expect.poll(async () => (await deskCards(page).first().boundingBox())!.x).toBeLessThan(before - 50)
  })

  test("the DESTAQUES label is never inside the rounded corner zone (sidebar open and collapsed, 1024 to 1920)", async ({ page, context, baseURL }) => {
    for (const sidebarOpen of [true, false]) {
      await context.clearCookies()
      await setup(context, baseURL!, sidebarOpen)
      for (const width of [1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 })
        await open(page)
        const frame = (await page.locator("[data-app-scroll]").boundingBox())!
        const label = (await page.getByRole("heading", { name: "Destaques", level: 2 }).boundingBox())!
        const button = (await page.getByRole("button", { name: "Personalizar" }).boundingBox())!
        // 24 px is the frame radius: a control closer than that to the top edge would sit in the curve.
        expect(label.y - frame.y, `label @${width} sidebar ${sidebarOpen}`).toBeGreaterThanOrEqual(24)
        expect(button.y - frame.y, `button @${width} sidebar ${sidebarOpen}`).toBeGreaterThanOrEqual(24)
        expect(label.x - frame.x).toBeGreaterThanOrEqual(0)
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
      }
    }
  })

  test("turn a highlight off and reorder: both survive a reload; Ativar todos / Desativar todos", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    await customize(page)
    await page.getByRole("switch", { name: "Desligar Água" }).click()
    await page.getByRole("button", { name: "Mover Hábitos de hoje para cima" }).click()
    await waitSaved(context, (p) => p?.highlights?.[0]?.id === "habitos-hoje" && p.highlights.find((h: { id: string }) => h.id === "agua")?.enabled === false)
    await page.getByRole("button", { name: "Pronto" }).click()

    await page.reload()
    await expect(page.locator('[data-slot="carousel"] [data-slot="carousel-item"]')).toHaveCount(15, { timeout: 60000 })
    await expect(deskCards(page).first()).toHaveAttribute("aria-label", /^Hábitos de hoje:/)
    await expect(page.getByRole("link", { name: /^Água:/ })).toHaveCount(0)

    await customize(page)
    await page.getByRole("button", { name: "Ativar todos", exact: true }).click()
    await expect(page.getByText("16 de 16 ligados")).toBeVisible()
    await page.getByRole("button", { name: "Desativar todos" }).click()
    await expect(page.getByText("Nenhum destaque ligado")).toBeVisible()
    await page.getByRole("button", { name: "Pronto" }).click()
    // Zero enabled: the strip is gone but the way back (Personalizar) stays.
    await expect(page.locator('[data-slot="carousel"]')).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Personalizar" })).toBeVisible()
  })

  test("Atrasados is open and emphasized; every group folds, with a summary, and the choice survives a reload", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const list = page.getByTestId("seu-dia-list")
    const overdue = list.getByRole("button", { name: /^Atrasados/ })
    await expect(overdue).toHaveAttribute("aria-expanded", "true")
    await expect(list.locator('[data-group="atrasados"] [data-kind]').first()).toContainText(/há \d+ dias?/)
    await expect(page.getByTestId("seu-dia-summary")).toContainText(/\d+ atrasados/)

    // Each header is a button with aria-expanded and, folded, a short summary.
    await overdue.click()
    await expect(overdue).toHaveAttribute("aria-expanded", "false")
    await expect(overdue).toContainText(/\d+ pendentes?/)
    const evening = list.getByRole("button", { name: /^Noite/ })
    await evening.click()
    await expect(evening).toHaveAttribute("aria-expanded", "false")
    const done = list.getByRole("button", { name: /^Concluídos/ })
    await expect(done).toHaveAttribute("aria-expanded", "false")
    await done.click()
    await expect(done).toHaveAttribute("aria-expanded", "true")
    await waitSaved(context, (p) => p?.collapsedGroups?.atrasados === true && p.collapsedGroups.noite === true && p.collapsedGroups.concluidos === false)

    await page.reload()
    const again = page.getByTestId("seu-dia-list")
    await expect(again.getByRole("button", { name: /^Atrasados/ })).toHaveAttribute("aria-expanded", "false", { timeout: 60000 })
    await expect(again.getByRole("button", { name: /^Noite/ })).toHaveAttribute("aria-expanded", "false")
    await expect(again.getByRole("button", { name: /^Concluídos/ })).toHaveAttribute("aria-expanded", "true")
  })

  test("filter chips show counts and hide empty kinds", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const filters = page.getByRole("group", { name: "Filtrar o dia" })
    await expect(filters.getByRole("button", { name: /^Tarefas \d+$/ })).toBeVisible()
    // No bill is due today, so its chip is not offered at all (a chip with 0 items is hidden).
    await expect(filters.getByRole("button", { name: /^Finanças/ })).toHaveCount(0)
    await filters.getByRole("button", { name: /^Hábitos \d+$/ }).click()
    await expect(page.locator('[data-testid="seu-dia-list"] [data-kind="task"]')).toHaveCount(0)
    await filters.getByRole("button", { name: /^Tudo/ }).click()
    await expect(page.locator('[data-testid="seu-dia-list"] [data-kind="habit"]').first()).toBeVisible()
  })

  test("the next item has the Lima bar and a 'Próximo · em' badge; high priority has a flag; quantity habits have progress", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const list = page.getByTestId("seu-dia-list")
    await expect(list.locator('[data-mark="next"]').first()).toContainText(/Próximo · em/)
    await expect(list.getByText("Prioridade alta").first()).toBeAttached()
    await expect(list.getByRole("button", { name: /Adicionar .* a Ler 20 páginas/ })).toBeVisible()
    await expect(list.getByText(/0 de 20 páginas/).first()).toBeVisible()
  })

  test("complete an item in Seu dia, watch the card follow, then undo", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const habits = deskCards(page).filter({ hasText: "Hábitos de hoje" }).first()
    await expect(habits).toContainText("1/5")
    await page.getByRole("checkbox", { name: "Concluir Treinar" }).click()
    await expect(habits).toContainText("2/5")
    await expect(page.getByText("Concluído.", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Desfazer" }).click()
    await expect(habits).toContainText("1/5")
  })

  test("every panel folds the same way and remembers it; Notas e lembretes is compact inside", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    for (const id of ["notas", "financas", "dieta", "treino", "estudos", "humor"]) {
      const panel = page.locator(`[data-panel="${id}"]`)
      await expect(panel.locator("button[aria-controls]")).toHaveAttribute("aria-expanded", "false")
      await expect(panel.getByRole("link", { name: /^Abrir / })).toBeVisible()
    }
    await expect(page.locator('[data-panel="notas"]')).toContainText("2 lembretes hoje · 2 fixadas")
    await expect(page.locator('[data-panel="humor"]')).toContainText("Ainda não registrado")

    const notes = page.locator('[data-panel="notas"]')
    await notes.locator("button[aria-controls]").click()
    await expect(notes.getByRole("button", { name: /^Ações do lembrete/ })).toHaveCount(2)
    await expect(notes.getByRole("link", { name: "Ver todas" })).toBeVisible()
    await notes.getByRole("button", { name: /^Ações do lembrete/ }).first().click()
    await page.getByRole("menuitem", { name: "Feito" }).click()
    await expect(page.getByText("Lembrete concluído.")).toBeVisible()
    await notes.getByRole("textbox", { name: "Nota rápida" }).fill("Comprar pilhas")
    await notes.getByRole("textbox", { name: "Nota rápida" }).press("Enter")
    await expect(notes.getByText("Comprar pilhas")).toBeVisible()

    await waitSaved(context, (p) => p?.expandedPanels?.includes("notas"))
    await page.reload()
    await expect(page.locator('[data-panel="notas"] button[aria-controls]')).toHaveAttribute("aria-expanded", "true", { timeout: 60000 })
  })

  test("hide a panel in Personalizar; Restaurar padrão asks first", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    await customize(page)
    await page.getByRole("switch", { name: "Esconder Notas e lembretes" }).click()
    await expect(page.locator('[data-panel="notas"]')).toHaveCount(0)
    await page.getByRole("button", { name: "Restaurar padrão" }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await page.getByRole("button", { name: "Restaurar", exact: true }).click()
    await expect(page.locator('[data-panel="notas"]')).toBeVisible()
  })
})

test("the assistant insight line is gone", async ({ page, context, baseURL }) => {
  await setup(context, baseURL!)
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page)
  await expect(page.getByText(/12% menos com restaurantes/)).toHaveCount(0)
  await expect(page.getByText(/Insight · toque para conversar/)).toHaveCount(0)
})
