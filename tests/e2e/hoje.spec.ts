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
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
    await setup(context, baseURL!)
    await open(page)
    const rows = page.locator('[data-testid="seu-dia-list"] [data-kind]')
    await expect(rows.first()).toBeVisible()
    for (const row of (await rows.all()).slice(0, 4)) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(63)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })

  test("0 tasks never shows 100%: postponing everything leaves no bar and an honest line", async ({ page, context, baseURL }) => {
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
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
        // 24 px is the frame radius. Text must clear it; the pill-shaped button already follows the curve, so 16 px is enough for it.
        expect(label.y - frame.y, `label @${width} sidebar ${sidebarOpen}`).toBeGreaterThanOrEqual(24)
        expect(button.y - frame.y, `button @${width} sidebar ${sidebarOpen}`).toBeGreaterThanOrEqual(16)
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
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
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
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
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
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
    await setup(context, baseURL!)
    await open(page)
    const list = page.getByTestId("seu-dia-list")
    await expect(list.locator('[data-mark="next"]').first()).toContainText(/Próximo · em/)
    await expect(list.getByText("Prioridade alta").first()).toBeAttached()
    await expect(list.getByRole("button", { name: /Adicionar .* a Ler 20 páginas/ })).toBeVisible()
    await expect(list.getByText(/0 de 20 páginas/).first()).toBeVisible()
  })

  test("complete an item in Seu dia, watch the card follow, then undo", async ({ page, context, baseURL }) => {
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
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
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
    await setup(context, baseURL!)
    await open(page)
    // Notas e lembretes starts open for a new person; the rest start folded.
    for (const id of ["notas", "financas", "dieta", "treino", "estudos", "humor"]) {
      const panel = page.locator(`[data-panel="${id}"]`)
      await expect(panel.locator("button[aria-controls]")).toHaveAttribute("aria-expanded", id === "notas" ? "true" : "false")
      await expect(panel.getByRole("link", { name: /^Abrir / })).toBeVisible()
    }
    await expect(page.locator('[data-panel="notas"]')).toContainText("2 lembretes hoje · 2 fixadas")
    await expect(page.locator('[data-panel="humor"]')).toContainText("Ainda não registrado")

    const notes = page.locator('[data-panel="notas"]')
    await expect(notes.getByRole("button", { name: /^Ações do lembrete/ })).toHaveCount(2)
    await expect(notes.getByRole("link", { name: "Ver todas" })).toBeVisible()
    await notes.getByRole("button", { name: /^Ações do lembrete/ }).first().click()
    await page.getByRole("menuitem", { name: "Feito" }).click()
    await expect(page.getByText("Lembrete concluído.")).toBeVisible()
    await notes.getByRole("textbox", { name: "Nota rápida" }).fill("Comprar pilhas")
    await notes.getByRole("textbox", { name: "Nota rápida" }).press("Enter")
    await expect(notes.getByText("Comprar pilhas")).toBeVisible()

    // Folding it lasts only for this visit: it is open again after a reload.
    await notes.locator("button[aria-controls]").click()
    await expect(notes.locator("button[aria-controls]")).toHaveAttribute("aria-expanded", "false")
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

// ---------------------------------------------------------------------------------------------------------------------
// Round 2

/** Contrast ratio of an element's text on its card, resolving any CSS color (color-mix, oklch) through a canvas. */
async function contrastOf(page: Page, selector: string, surface: string) {
  return page.evaluate(
    ([sel, surf]) => {
      const rgba = (css: string) => {
        const c = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!
        c.clearRect(0, 0, 1, 1)
        c.fillStyle = css
        c.fillRect(0, 0, 1, 1)
        const d = c.getImageData(0, 0, 1, 1).data
        return [d[0], d[1], d[2], d[3] / 255]
      }
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const el = document.querySelector(sel)!
      const bg = rgba(getComputedStyle(document.querySelector(surf)!).backgroundColor)
      const fg = rgba(getComputedStyle(el).color)
      const mixed = [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
      const [a, b] = [lum(mixed), lum(bg)].sort((x, y) => y - x)
      return (a + 0.05) / (b + 0.05)
    },
    [selector, surface]
  )
}

const lima = (page: Page) => page.locator('a[data-tone="highlight"]:visible')

/**
 * Contrast of text on a surface that may be translucent (the hover lift): the surface color is read from the rendered pixels
 * (a screenshot of a spot inside the card's padding), then the text color is composited over it.
 */
async function contrastOnPixels(page: Page, textSelector: string, surfaceSelector: string) {
  const box = (await page.locator(surfaceSelector).boundingBox())!
  const png = await page.screenshot({ clip: { x: box.x + 8, y: box.y + box.height / 2, width: 2, height: 2 } })
  return page.evaluate(
    async ([base64, sel]) => {
      const blob = await (await fetch("data:image/png;base64," + base64)).blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!
      ctx.drawImage(bitmap, 0, 0)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      const lum = ([x, y, z]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(x) + 0.7152 * f(y) + 0.0722 * f(z)
      }
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = getComputedStyle(document.querySelector(sel)!).color
      ctx.fillRect(0, 0, 1, 1)
      const [tr, tg, tb, ta] = ctx.getImageData(0, 0, 1, 1).data
      const alpha = ta / 255
      const text = [tr * alpha + r * (1 - alpha), tg * alpha + g * (1 - alpha), tb * alpha + b * (1 - alpha)]
      const [hi, lo] = [lum(text), lum([r, g, b])].sort((p, q) => q - p)
      return (hi + 0.05) / (lo + 0.05)
    },
    [png.toString("base64"), textSelector]
  )
}

const bg = (locator: ReturnType<Page["locator"]>) => locator.evaluate((el) => getComputedStyle(el).backgroundColor)

test.describe("round 2: desktop (1440x900)", () => {
  test.use(desktop)

  test("everything pressable shows a hand, a disabled control says so", async ({ page, context, baseURL }) => {
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
    await setup(context, baseURL!)
    await open(page)
    const cursor = (locator: ReturnType<Page["locator"]>) => locator.evaluate((el) => getComputedStyle(el).cursor)
    const list = page.getByTestId("seu-dia-list")
    const pointers = {
      next: page.getByRole("button", { name: "Próximos destaques" }),
      personalizar: page.getByRole("button", { name: "Personalizar" }),
      chip: page.getByRole("button", { name: /^Tarefas \d/ }),
      groupHeader: list.getByRole("button", { name: /^Atrasados/ }),
      panelHeader: page.locator('[data-panel="financas"] button[aria-controls]'),
      openModule: page.getByRole("link", { name: "Abrir Finanças" }),
      agenda: page.getByRole("link", { name: "Abrir agenda" }),
      checkbox: list.getByRole("checkbox").first(),
      plus: list.getByRole("button", { name: /^Adicionar/ }).first(),
    }
    for (const [name, locator] of Object.entries(pointers)) expect(await cursor(locator), name).toBe("pointer")
    // The "previous" arrow starts disabled (the row is at its start).
    expect(await cursor(page.getByRole("button", { name: "Destaques anteriores" }))).toBe("not-allowed")
  })

  test("clicking the TITLE of a side panel toggles it; the arrow beside it only opens the module", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const finance = page.locator('[data-panel="financas"]')
    const toggle = finance.locator("button[aria-controls]")
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await finance.getByRole("heading", { name: "Finanças" }).click()
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await expect(finance.getByText("Orçamento", { exact: true }).first()).toBeVisible()
    // Clicking the summary line (also inside the header row) folds it again.
    await finance.locator("button[aria-controls] span.truncate").click()
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    // The header button spans the row except for the module arrow, which is a link, not inside the button.
    const t = (await toggle.boundingBox())!
    const arrow = finance.getByRole("link", { name: "Abrir Finanças" })
    expect(t.x + t.width).toBeLessThanOrEqual((await arrow.boundingBox())!.x + 1)
    await expect(arrow.locator("xpath=ancestor::button")).toHaveCount(0)
  })

  test("a new person: Notas e lembretes is open on the normal surface, the other panels are folded", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const notes = page.locator('[data-panel="notas"] section')
    const finance = page.locator('[data-panel="financas"] section')
    await expect(page.locator('[data-panel="notas"] button[aria-controls]')).toHaveAttribute("aria-expanded", "true")
    await expect(page.locator('[data-panel="financas"] button[aria-controls]')).toHaveAttribute("aria-expanded", "false")
    // Same surface as every other card, and not the Lima highlight.
    expect(await bg(notes)).toBe(await bg(finance))
    expect(await bg(notes)).not.toBe(await bg(lima(page).first()))
  })

  test("exactly one Lima highlight: the first card in view; it moves with the arrows and returns to normal behind", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    // First paint: card 1 is Lima and it is the only one.
    await expect(lima(page)).toHaveCount(1)
    await expect(deskCards(page).first()).toHaveAttribute("data-tone", "highlight")
    const limaColor = await bg(deskCards(page).first())
    const normalColor = await bg(deskCards(page).nth(1))
    expect(limaColor).not.toBe(normalColor)

    // The first card in view (left edge) after each arrow press is the Lima one.
    const firstInView = async () => {
      const row = (await page.locator('[data-slot="carousel"]').boundingBox())!
      const cards = await deskCards(page).all()
      for (let i = 0; i < cards.length; i++) {
        const b = (await cards[i].boundingBox())!
        if (b.x + b.width * 0.6 > row.x) return i
      }
      return -1
    }
    for (let press = 0; press < 3; press++) {
      await page.getByRole("button", { name: "Próximos destaques" }).click()
      await expect.poll(async () => deskCards(page).nth(await firstInView()).getAttribute("data-tone")).toBe("highlight")
      await expect(lima(page)).toHaveCount(1)
    }
    expect(await firstInView()).toBeGreaterThan(0)
    // The first card went back to the normal surface (the color eases over 0.4 s).
    await expect(deskCards(page).first()).toHaveAttribute("data-tone", "default")
    await expect.poll(() => bg(deskCards(page).first())).toBe(normalColor)

    // At the very end of the track, the first card in view is still the Lima one.
    const next = page.getByRole("button", { name: "Próximos destaques" })
    for (let i = 0; i < 20 && (await next.isEnabled()); i++) await next.click()
    await expect(lima(page)).toHaveCount(1)
    await expect.poll(async () => deskCards(page).nth(await firstInView()).getAttribute("data-tone")).toBe("highlight")

    // Lima card text: secondary text (Tinta 70%) stays readable in both schemes.
    await lima(page).first().evaluate((el) => el.setAttribute("data-probe", "1"))
    for (const scheme of ["dark", "light"] as const) {
      await page.evaluate((s) => document.documentElement.classList.toggle("dark", s === "dark"), scheme)
      await page.waitForTimeout(600) // the text colors ease over 0.4 s
      expect(await contrastOf(page, '[data-probe="1"] > span:nth-of-type(3)', '[data-probe="1"]'), `support ${scheme}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  test("hovering a side-panel header looks exactly like hovering a Destaques card", async ({ page, context, baseURL }) => {
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
    await setup(context, baseURL!)
    await open(page)
    const look = (locator: ReturnType<Page["locator"]>) =>
      locator.evaluate((el) => {
        const s = getComputedStyle(el)
        return { background: s.backgroundColor, cursor: s.cursor, duration: s.transitionDuration, easing: s.transitionTimingFunction, property: s.transitionProperty }
      })
    const card = deskCards(page).nth(1)
    await card.hover()
    await page.waitForTimeout(500)
    const onCard = await look(card)
    // The whole panel card takes the Destaques look (surface, ease, easing); the header row itself keeps the hand cursor.
    const header = page.locator('[data-panel="financas"] button[aria-controls]')
    const section = page.locator('[data-panel="financas"] section')
    await header.hover()
    await page.waitForTimeout(500)
    expect(await look(section)).toEqual({ ...onCard, cursor: "auto" })
    expect((await look(header)).cursor).toBe("pointer")
    // And the Seu dia group headers share it.
    const group = page.getByTestId("seu-dia-list").getByRole("button", { name: /^Atrasados/ })
    await group.hover()
    await page.waitForTimeout(500)
    expect(await look(group)).toEqual(onCard)
  })

  test("the first side panel opens on every load: collapsing it lasts only for the visit; the others remember", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const notes = page.locator('[data-panel="notas"] button[aria-controls]')
    const finance = page.locator('[data-panel="financas"] button[aria-controls]')
    await expect(notes).toHaveAttribute("aria-expanded", "true")

    // Collapse it, open Finanças, reload: Notas is open again, Finanças is still open.
    await notes.click()
    await expect(notes).toHaveAttribute("aria-expanded", "false")
    await finance.click()
    await waitSaved(context, (p) => p?.expandedPanels?.includes("financas"))
    expect((await savedPrefs(context)).expandedPanels).not.toContain("notas")
    await page.reload()
    await expect(page.locator('[data-panel="notas"] button[aria-controls]')).toHaveAttribute("aria-expanded", "true", { timeout: 60000 })
    await expect(page.locator('[data-panel="financas"] button[aria-controls]')).toHaveAttribute("aria-expanded", "true")

    // Server-rendered open: the HTML already has it expanded (no flash, no jump).
    const html = await (await page.request.get("/dashboard")).text()
    expect(html).toMatch(/aria-expanded="true"[^>]*aria-controls|aria-controls[^>]*aria-expanded="true"/)

    // Hide the first panel: the next one becomes the one that opens on load.
    await customize(page)
    await page.getByRole("switch", { name: "Esconder Notas e lembretes" }).click()
    await page.getByRole("button", { name: "Pronto" }).click()
    await expect(page.locator('[data-panel="notas"]')).toHaveCount(0)
    await page.locator('[data-panel="financas"] button[aria-controls]').click()
    await page.reload()
    await expect(page.locator('[data-panel="financas"] button[aria-controls]')).toHaveAttribute("aria-expanded", "true", { timeout: 60000 })
    await expect(page.locator('[data-panel="dieta"] button[aria-controls]')).toHaveAttribute("aria-expanded", "false")
  })

  test("the WHOLE side panel lifts like a Destaques card: title, body and empty area, open and folded; contrast holds", async ({ page, context, baseURL }) => {
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
    await setup(context, baseURL!)
    await open(page)
    const card = deskCards(page).nth(1)
    await card.hover()
    await page.waitForTimeout(500)
    const reference = await bg(card)
    const normal = await bg(page.locator('[data-panel="dieta"] section'))
    expect(reference).not.toBe(normal)

    const notes = page.locator('[data-panel="notas"] section')
    const spots = [
      page.getByRole("heading", { name: "Notas e lembretes" }),
      notes.getByText("Notas fixadas", { exact: true }),
      // Empty area: the right half of the bottom padding.
      null,
    ]
    for (const spot of spots) {
      if (spot) await spot.hover()
      else {
        // Empty area: inside the bottom padding, right of "Ver todas" (clear of the assistant button).
        const box = (await notes.boundingBox())!
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height - 8)
      }
      await page.waitForTimeout(500)
      expect(await bg(notes)).toBe(reference)
    }
    // Folded panel too.
    const diet = page.locator('[data-panel="dieta"] section')
    await diet.locator("button[aria-controls]").hover()
    await page.waitForTimeout(500)
    expect(await bg(diet)).toBe(reference)
    // Pointer leaves: back to the normal surface.
    await page.mouse.move(5, 5)
    await expect.poll(() => bg(diet)).toBe(normal)

    // Inner controls keep their own hover and the card stays lifted under them.
    const quick = notes.getByRole("textbox", { name: "Nota rápida" })
    await quick.hover()
    await page.waitForTimeout(500)
    expect(await bg(notes)).toBe(reference)
    expect(await quick.evaluate((el) => getComputedStyle(el).cursor)).toBe("text")

    // Text on the hovered card stays readable, dark and light.
    for (const scheme of ["dark", "light"] as const) {
      await page.evaluate((s) => document.documentElement.classList.toggle("dark", s === "dark"), scheme)
      await page.getByRole("heading", { name: "Notas e lembretes" }).hover()
      await page.waitForTimeout(700)
      const surface = '[data-panel="notas"] section'
      expect(await contrastOnPixels(page, '[data-panel="notas"] h2', surface), `title ${scheme}`).toBeGreaterThanOrEqual(4.5)
      expect(await contrastOnPixels(page, '[data-panel="notas"] button[aria-controls] span.truncate', surface), `summary ${scheme}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  test("the Agenda link is a quiet ghost link; both arrows are Lima buttons with a hand cursor; a disabled arrow is muted and not-allowed", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const limaColor = await bg(lima(page).first())
    const agenda = page.getByRole("region", { name: "Seu dia" }).getByRole("link", { name: /^Agenda/ })
    const next = page.getByRole("button", { name: "Próximos destaques" })
    const prev = page.getByRole("button", { name: "Destaques anteriores" })
    await page.mouse.move(5, 5)
    await expect.poll(() => bg(next)).toBe(limaColor)
    expect(await bg(agenda)).not.toBe(limaColor)
    for (const control of [agenda, next]) expect(await control.evaluate((el) => getComputedStyle(el).cursor)).toBe("pointer")
    // "Anterior" starts disabled: muted surface, reduced opacity, not-allowed.
    await expect(prev).toBeDisabled()
    expect(await bg(prev)).not.toBe(limaColor)
    expect(await prev.evaluate((el) => getComputedStyle(el).cursor)).toBe("not-allowed")
    expect(Number(await prev.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(1)

    for (const scheme of ["dark", "light"] as const) {
      await page.evaluate((s) => document.documentElement.classList.toggle("dark", s === "dark"), scheme)
      await page.mouse.move(5, 5)
      await page.waitForTimeout(600)
      await next.evaluate((el) => el.setAttribute("data-probe", "next"))
      expect(await contrastOf(page, '[data-probe="next"] svg', '[data-probe="next"]'), `arrow ${scheme}`).toBeGreaterThanOrEqual(4.5)
    }
    // Hovering darkens/lightens the Lima slightly, never a new color: it stays a Lima mix.
    await agenda.hover()
    await page.waitForTimeout(500)
    expect(await bg(agenda)).not.toBe("rgba(0, 0, 0, 0)")
  })

  test("Destaques sits close to the top of the page and the two columns align to the top", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const scroller = (await page.locator("[data-app-scroll]").boundingBox())!
    const label = (await page.getByRole("heading", { name: "Destaques", level: 2 }).boundingBox())!
    expect(label.y - scroller.y).toBeLessThanOrEqual(32)
    const main = (await page.locator('[data-panel="seu-dia"]').boundingBox())!
    const aside = (await page.locator('[data-panel="notas"]').boundingBox())!
    expect(Math.abs(main.y - aside.y)).toBeLessThanOrEqual(1)
  })

  test("opening a Seu dia group never moves the side panels, and opening a panel never stretches the others", async ({ page, context, baseURL }) => {
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
    await setup(context, baseURL!)
    await open(page)
    const panels = ["notas", "financas", "dieta", "treino", "estudos", "humor"]
    // Positions relative to the scrolled page, so a scroll adjustment after folding a group is not mistaken for a move.
    const scrollTop = () => page.locator("[data-app-scroll]").evaluate((el) => el.scrollTop)
    const boxes = async () => {
      const top = await scrollTop()
      return Promise.all(panels.map(async (id) => { const b = (await page.locator(`[data-panel="${id}"] section`).boundingBox())!; return { ...b, y: b.y + top } }))
    }
    const start = await boxes()
    const list = page.getByTestId("seu-dia-list")
    const concluded = list.getByRole("button", { name: /^Concluídos/ })
    const wasOpen = (await concluded.getAttribute("aria-expanded")) === "true"
    await concluded.click()
    await expect(concluded).toHaveAttribute("aria-expanded", wasOpen ? "false" : "true")
    await list.getByRole("button", { name: /^Atrasados/ }).click()
    expect(await boxes()).toEqual(start)

    // Opening Finanças grows only Finanças; the gaps between panels stay the same.
    await page.locator('[data-panel="financas"] button[aria-controls]').click()
    await expect.poll(async () => (await boxes())[1].height).toBeGreaterThan(start[1].height + 40)
    const grown = await boxes()
    grown.forEach((b, i) => {
      if (i !== 1) expect(Math.round(b.height)).toBe(Math.round(start[i].height))
    })
    for (let i = 0; i < panels.length - 1; i++) {
      const gap = grown[i + 1].y - (grown[i].y + grown[i].height)
      const gap0 = start[i + 1].y - (start[i].y + start[i].height)
      expect(Math.round(gap)).toBe(Math.round(gap0))
    }
  })

  test("the mouse wheel scrolls the page over Seu dia, the side panels and Destaques alike", async ({ page, context, baseURL }) => {
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
    await setup(context, baseURL!)
    await open(page)
    const scroller = page.locator("[data-app-scroll]")
    // On desktop the frame stays put and [data-app-scroll] is the page: no inner scroll area may swallow the wheel.
    expect(await page.getByTestId("seu-dia-list").evaluate((el) => getComputedStyle(el).overflowY)).toBe("visible")
    const scrolls = async (target: ReturnType<Page["locator"]>) => {
      await scroller.evaluate((el) => (el.scrollTop = 0))
      const box = (await target.boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 120))
      await page.mouse.wheel(0, 400)
      await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(100)
    }
    await scrolls(page.getByTestId("seu-dia-list"))
    await scrolls(page.locator('[data-panel="notas"]'))
    await scrolls(deskCards(page).nth(1))
  })

  test("Sem horário reserves no time column: the icon starts at the left edge, level with the group label", async ({ page, context, baseURL }) => {
    test.fixme(true, "Written for the old built-in example data, which no longer exists. Needs the seeded demo account (npm run seed:demo) and a signed-in session; adapt the login and run it there.")
    await setup(context, baseURL!)
    await open(page)
    const group = page.locator('[data-group="sem-horario"]')
    const header = group.getByRole("button", { name: /^Sem horário/ })
    if ((await header.getAttribute("aria-expanded")) !== "true") await header.click()
    const g = (await group.boundingBox())!
    const row = group.locator("[data-kind]").first()
    const icon = (await row.locator("svg").first().boundingBox())!
    expect(icon.x - g.x).toBeLessThanOrEqual(2)
    const label = (await group.getByRole("heading", { name: "Sem horário" }).boundingBox())!
    const title = (await row.locator("a span").first().boundingBox())!
    expect(Math.abs(title.x - label.x)).toBeLessThanOrEqual(4)
    // A timed group keeps its column.
    const morning = page.locator('[data-group="manha"] [data-kind]').first()
    if (await morning.count()) expect((await morning.locator("a span").first().boundingBox())!.x - g.x).toBeGreaterThan(60)
  })

  test("the Agenda link is a 40 px ghost link with an arrow, at the right of the card header", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const agenda = page.getByRole("region", { name: "Seu dia" }).getByRole("link", { name: /^Agenda/ })
    const b = (await agenda.boundingBox())!
    expect(b.height).toBeGreaterThanOrEqual(40)
    expect(await agenda.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)")
    expect(await agenda.locator("svg").count()).toBe(1)
    const card = (await page.getByRole("region", { name: "Seu dia" }).boundingBox())!
    expect(card.x + card.width - (b.x + b.width)).toBeLessThanOrEqual(24)
  })
})

test.describe("round 2: phone (390x844)", () => {
  test.use(phone)

  test("the deck has one Lima card, the front one, and it changes with the swipe; Notas is open on the normal surface; the panel title toggles", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const deck = page.locator(".swiper").first()
    await expect(deck.locator('.swiper-slide-active a[data-tone="highlight"]')).toHaveCount(1)
    // Only the front card is Lima; the ones behind keep the normal surface and their border.
    await expect(deck.locator('.swiper-slide:not(.swiper-slide-active) a[data-tone="highlight"]')).toHaveCount(0)
    const front = await deck.locator(".swiper-slide-active a").getAttribute("aria-label")

    const box = (await deck.boundingBox())!
    const y = box.y + box.height / 2
    await page.mouse.move(box.x + box.width * 0.8, y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.1, y, { steps: 12 })
    await page.mouse.up()
    await expect(page.getByText("2 de 16", { exact: true })).toBeVisible()
    await expect(deck.locator('.swiper-slide-active a[data-tone="highlight"]')).toHaveCount(1)
    expect(await deck.locator(".swiper-slide-active a").getAttribute("aria-label")).not.toBe(front)
    await expect(deck.locator('.swiper-slide:not(.swiper-slide-active) a[data-tone="highlight"]')).toHaveCount(0)

    await expect(page.locator('[data-panel="notas"] button[aria-controls]')).toHaveAttribute("aria-expanded", "true")
    expect(await bg(page.locator('[data-panel="notas"] section'))).toBe(await bg(page.locator('[data-panel="financas"] section')))
    const finance = page.locator('[data-panel="financas"]')
    await finance.getByRole("heading", { name: "Finanças" }).click()
    await expect(finance.locator("button[aria-controls]")).toHaveAttribute("aria-expanded", "true")
  })

  test("reduced motion: the flat strip marks the first visible card as Lima", async ({ page, context, baseURL }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await setup(context, baseURL!)
    await open(page)
    const strip = page.locator('[aria-roledescription="carousel"]').first()
    await expect(strip.locator('a[data-tone="highlight"]')).toHaveCount(1)
    await expect(strip.locator("[data-index='0'] a")).toHaveAttribute("data-tone", "highlight")
    await strip.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: "instant" }))
    await expect(strip.locator("[data-index='0'] a")).toHaveAttribute("data-tone", "default")
    await expect(strip.locator('a[data-tone="highlight"]')).toHaveCount(1)
  })

  test("Notas opens again after a reload even if it was folded; Abrir agenda is an icon-only 44 px button", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!)
    await open(page)
    const notes = page.locator('[data-panel="notas"] button[aria-controls]')
    await expect(notes).toHaveAttribute("aria-expanded", "true")
    await notes.click()
    await expect(notes).toHaveAttribute("aria-expanded", "false")
    await page.reload()
    await expect(page.locator('[data-panel="notas"] button[aria-controls]')).toHaveAttribute("aria-expanded", "true", { timeout: 60000 })
    // Tapping the panel card lifts it like a Destaques card (touch has no hover, but the style exists for the tap).
    const agenda = page.getByRole("link", { name: "Abrir agenda" })
    await agenda.scrollIntoViewIfNeeded()
    const box = (await agenda.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeGreaterThanOrEqual(44)
    await expect(agenda).not.toContainText("Agenda")
  })

})
