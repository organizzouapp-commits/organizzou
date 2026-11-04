/**
 * Finanças, series B (bento): each tab on desktop and phones, the cash-flow chart (tap / keyboard), Pagar + Desfazer, the month timeline
 * filtering the list, carousels that scroll without a horizontal page scroll at 360/390/430, widths 768–1920, dark and light.
 * On the development fixture /design-system/financas (every row in memory):
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test financas-bento
 */
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const cat = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const COLORS = { colors: { priority: {}, tag: {}, category: { [cat(1)]: "azul", [cat(2)]: "verde", [cat(3)]: "laranja" }, task: {}, event: {} }, custom: [] }

async function consent(context: BrowserContext, baseURL: string, theme = "dark") {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
  await context.addInitScript(([t, colors]) => {
    try {
      localStorage.setItem("theme", t)
      localStorage.setItem("organizzou:tarefas-colors", colors)
    } catch {}
  }, [theme, JSON.stringify(COLORS)])
}

type Tab = "Visão geral" | "Lançamentos" | "Contas fixas" | "Metas"
const SHORT: Record<Tab, string> = { "Visão geral": "Geral", Lançamentos: "Lançamentos", "Contas fixas": "Fixas", Metas: "Metas" }

async function open(page: Page, tab?: Tab, short = false) {
  await page.goto("/design-system/financas")
  await expect(page.getByRole("tablist", { name: "Finanças" })).toBeVisible({ timeout: 60000 })
  if (tab) {
    const target = page.getByRole("tab", { name: short ? SHORT[tab] : tab, exact: true })
    // The first click can land before hydration finishes; click again until the tab is selected.
    await expect(async () => {
      await target.click()
      await expect(target).toHaveAttribute("aria-selected", "true", { timeout: 1500 })
    }).toPass({ timeout: 20000 })
  }
}

const undoBtn = (page: Page) => page.locator("[data-sonner-toast]").first().getByRole("button", { name: "Desfazer" })
const computed = (loc: Locator, prop: string) => loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)
const noPageScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

/** Nothing inside a card pokes out of it. */
const noCardOverflow = (page: Page) =>
  page.evaluate(() => {
    const bad: string[] = []
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-bento-card],[data-stat-tile],[data-hero-card]"))) {
      const box = el.getBoundingClientRect()
      for (const child of Array.from(el.querySelectorAll<HTMLElement>("[data-money],[data-item-title],[data-stat-chip]"))) {
        if (child.closest("[data-testid=accounts-carousel],[data-testid=goals-carousel],[data-testid=month-timeline]")) continue
        const c = child.getBoundingClientRect()
        if (c.width > 0 && (c.right > box.right + 1 || c.left < box.left - 1)) bad.push(`${el.getAttribute("aria-label")}: ${child.textContent?.slice(0, 30)}`)
      }
    }
    return bad
  })

async function swipe(loc: Locator, dx: number) {
  await loc.evaluate(async (el, delta) => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))
    const box = el.getBoundingClientRect()
    const x = box.left + box.width / 2
    const y = box.top + box.height / 2
    const fire = (type: string, cx: number) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", clientX: cx, clientY: y, isPrimary: true }))
    fire("pointerdown", x)
    for (let i = 1; i <= 6; i += 1) {
      fire("pointermove", x + (delta * i) / 6)
      await frame()
    }
    await frame()
    fire("pointerup", x + delta)
  }, dx)
}

async function contrast(page: Page, fg: string, bg: string) {
  return page.evaluate(
    ([a, b]) => {
      const rgb = (c: string) => {
        const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!
        ctx.fillStyle = c
        ctx.fillRect(0, 0, 1, 1)
        return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
      }
      const lum = ([r, g, bl]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl)
      }
      const [l1, l2] = [lum(rgb(a)), lum(rgb(b))]
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    },
    [fg, bg]
  )
}

test.describe("desktop 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

  test("tabs switch, the month toolbar belongs to all but Metas", async ({ page }) => {
    await open(page)
    await expect(page.getByRole("tablist", { name: "Finanças" }).getByRole("tab")).toHaveText(["Visão geral", "Lançamentos", "Contas fixas", "Metas"])
    for (const name of ["Visão geral", "Lançamentos", "Contas fixas"] as const) {
      await open(page, name)
      await expect(page.getByTestId("month-title")).toBeVisible()
    }
    await page.getByRole("tab", { name: "Metas", exact: true }).click()
    await expect(page.getByTestId("month-title")).toHaveCount(0)
    await page.getByRole("tab", { name: "Visão geral", exact: true }).click()
    const title = page.getByTestId("month-title")
    const first = await title.textContent()
    await page.getByRole("button", { name: "Mês anterior" }).click()
    await expect(title).not.toHaveText(first!)
    await title.click()
    await expect(title).toHaveText(first!)
  })

  test("Visão geral: 12-column rows (hero | stats | budget, chart | watch, three equal cards), dimmed cents, hero actions", async ({ page }) => {
    await open(page)
    const grid = page.getByTestId("overview-grid")
    const box = async (loc: Locator) => (await loc.boundingBox())!
    const hero = await box(grid.locator("[data-hero-card]"))
    const stats = await box(page.getByTestId("stat-grid"))
    const budget = await box(page.getByTestId("budget-card"))
    expect(Math.abs(hero.y - stats.y)).toBeLessThan(2)
    expect(Math.abs(stats.y - budget.y)).toBeLessThan(2)
    expect(hero.x + hero.width).toBeLessThan(stats.x)
    expect(stats.x + stats.width).toBeLessThan(budget.x)
    // Spans 5 | 4 | 3 of 12.
    expect(hero.width / stats.width).toBeGreaterThan(1.1)
    expect(stats.width / budget.width).toBeGreaterThan(1.1)
    const flow = await box(page.getByTestId("cashflow-card"))
    const watch = await box(page.getByTestId("watch-list"))
    expect(Math.abs(flow.y - watch.y)).toBeLessThan(2)
    expect(flow.width).toBeGreaterThan(watch.width)
    const row3 = await Promise.all(["spending-card", "accounts-card", "goals-card"].map((id) => box(page.getByTestId(id))))
    expect(new Set(row3.map((b) => Math.round(b.y))).size).toBe(1)
    expect(new Set(row3.map((b) => Math.round(b.height))).size).toBe(1)
    // Hero: Transferir (Tinta pill, Lima text) and Pagar conta.
    const heroEl = grid.locator("[data-hero-card]")
    await expect(heroEl.getByRole("button", { name: "Transferir" })).toBeVisible()
    expect(await contrast(page, await computed(heroEl.getByRole("button", { name: "Transferir" }), "color"), await computed(heroEl.getByRole("button", { name: "Transferir" }), "background-color"))).toBeGreaterThan(4.5)
    expect(parseFloat(await computed(heroEl.getByRole("button", { name: "Pagar conta" }), "border-top-left-radius"))).toBeGreaterThan(100)
    await heroEl.getByRole("button", { name: "Transferir" }).click()
    await expect(page.getByText(/Transferências entre contas/)).toBeVisible()
    // Four stats, cents dimmed to 50%.
    const tiles = page.getByTestId("stat-grid").locator("[data-bento-stat]")
    await expect(tiles).toHaveText([/Entradas/, /Saídas/, /Saldo do mês/, /Fixas a pagar/])
    expect(await tiles.first().locator("[data-cents]").evaluate((el) => getComputedStyle(el).opacity)).toBe("0.5")
    await expect(tiles.nth(2)).toContainText("entradas − saídas")
    await expect(tiles.nth(3)).toContainText(/\d+ contas?/)
    expect(await noCardOverflow(page)).toEqual([])
    // Budget ring and the arrow circle on cards.
    await expect(page.getByTestId("budget-card").getByRole("progressbar", { name: "Orçamento usado" })).toHaveAttribute("aria-valuenow", /\d+/)
    await expect(page.getByTestId("watch-list").getByRole("button", { name: "Ver contas fixas" })).toBeVisible()
    expect(parseFloat(await computed(page.getByTestId("budget-card"), "border-top-left-radius"))).toBe(20)
    // Wallets 2x2 + dashed add pill.
    await expect(page.getByTestId("accounts-card").locator("[data-wallet]")).toHaveCount(4)
    await expect(page.getByTestId("accounts-card").getByText("Ativa").first()).toBeVisible()
    await expect(page.getByTestId("accounts-card").getByText("Adicionar conta…")).toBeVisible()
    await expect(page.getByTestId("goals-card").locator("[data-goal]")).toHaveCount(3)
  })

  test("cash-flow chart: month by click and by keyboard, the tooltip follows, Anual shows 12 months", async ({ page }) => {
    await open(page)
    const chart = page.getByTestId("cashflow-chart")
    const months = chart.locator("[data-month]")
    await expect(months).toHaveCount(6)
    await expect(months.last()).toHaveAttribute("aria-pressed", "true")
    const tip = page.getByTestId("cashflow-tooltip")
    await expect(tip).toContainText("Entradas")
    await expect(tip).toContainText("Saídas")
    // The selected month is Lima, the others hatched.
    expect(await computed(months.last().locator("[data-bar=income]"), "background-color")).not.toMatch(/rgba\(0, 0, 0, 0\)/)
    expect(await computed(months.first().locator("[data-bar=income]"), "background-image")).toContain("repeating-linear-gradient")
    await months.nth(1).click()
    await expect(months.nth(1)).toHaveAttribute("aria-pressed", "true")
    const label = (await months.nth(1).textContent())!.trim()
    await expect(tip).toContainText(label.slice(0, 3))
    await months.nth(1).focus()
    await page.keyboard.press("ArrowRight")
    await expect(months.nth(2)).toHaveAttribute("aria-pressed", "true")
    await expect(months.nth(2)).toBeFocused()
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.press("ArrowLeft")
    await expect(months.nth(0)).toHaveAttribute("aria-pressed", "true")
    await expect(chart).toHaveAttribute("aria-label", /Fluxo de caixa\./)
    expect(await months.nth(0).getAttribute("aria-label")).toMatch(/entradas R\$ .*, saídas R\$ /)
    await page.getByRole("group", { name: "Período do fluxo de caixa" }).getByRole("button", { name: "Anual" }).click()
    await expect(chart.locator("[data-month]")).toHaveCount(12)
    // The Lima pill of the segmented control.
    expect(await contrast(page, await computed(page.getByRole("button", { name: "Anual" }), "color"), await computed(page.getByRole("button", { name: "Anual" }), "background-color"))).toBeGreaterThan(4.5)
  })

  test("Para ficar de olho: Pagar + Desfazer", async ({ page }) => {
    await open(page)
    const watch = page.getByTestId("watch-list")
    await expect(watch.locator("[data-bill]")).toHaveCount(3)
    await watch.locator("[data-bill]").filter({ hasText: "Energia elétrica" }).getByRole("button", { name: "Pagar" }).click()
    await expect(page.getByText("Energia elétrica paga.")).toBeVisible()
    await expect(watch.locator("[data-bill]")).toHaveCount(2)
    await undoBtn(page).click()
    await expect(watch.locator("[data-bill]")).toHaveCount(3)
  })

  test("Lançamentos: 8/4 columns, Saídas do mês hero against the budget, stats, donut, quick add, filters, day groups", async ({ page }) => {
    await open(page, "Lançamentos")
    const main = page.getByTestId("transactions-main")
    const side = page.locator("aside").first()
    const [m, s] = [(await main.boundingBox())!, (await side.boundingBox())!]
    expect(m.width / s.width).toBeGreaterThan(1.7)
    const hero = side.locator("[data-hero-card]")
    await expect(hero).toContainText("Saídas do mês")
    await expect(hero).toContainText(/\d+% do orçamento de R\$/)
    await expect(hero.locator("[data-hatched]")).toHaveAttribute("aria-valuenow", /\d+/)
    await expect(side.locator("[data-bento-stat]")).toHaveText([/Entradas/, /Saldo do mês/])
    await expect(side.getByTestId("category-donut").locator("[data-segment]").first()).toBeVisible()
    expect(await side.getByTestId("category-donut").locator("[data-legend]").count()).toBeGreaterThan(2)
    // Segmented Todos | Entradas | Saídas.
    const seg = main.getByRole("group", { name: "Filtrar por tipo" })
    await expect(seg.getByRole("button")).toHaveText(["Todos", "Entradas", "Saídas"])
    await seg.getByRole("button", { name: "Entradas" }).click()
    await expect(main.locator("[data-transaction]")).toHaveCount(1)
    await seg.getByRole("button", { name: "Todos" }).click()
    // Quick add parses both forms.
    await main.locator("[data-add-task-pill]").click()
    const field = page.getByRole("textbox", { name: "Adicionar lançamento rápido" })
    await field.fill("mercado 45,90")
    await field.press("Enter")
    const row = main.locator("[data-transaction]").filter({ hasText: "− R$ 45,90" })
    await expect(row).toContainText("Mercado")
    await undoBtn(page).click()
    await expect(row).toHaveCount(0)
    await main.locator("[data-add-task-pill]").click()
    await page.getByRole("textbox", { name: "Adicionar lançamento rápido" }).fill("+ salário 5000")
    await page.getByRole("textbox", { name: "Adicionar lançamento rápido" }).press("Enter")
    await expect(main.locator("[data-transaction]").filter({ hasText: "+ R$ 5.000,00" }).first()).toBeVisible()
    // Day groups collapse.
    const header = main.locator("[data-day-group]").first().locator("[data-group-header]")
    await header.click()
    await expect(header).toHaveAttribute("aria-expanded", "false")
    await header.click()
    await expect(header).toHaveAttribute("aria-expanded", "true")
    // ⋯ has Editar and Excluir only.
    await main.locator("[data-transaction]").first().getByRole("button", { name: /^Ações de/ }).click()
    await expect(page.getByRole("menuitem")).toHaveText([/Editar/, /Excluir/])
    await page.keyboard.press("Escape")
  })

  test("Contas fixas: hero with progress, stats, month timeline filters the list, Lista hides the timeline, Pagar + Desfazer", async ({ page }) => {
    await open(page, "Contas fixas")
    const hero = page.locator("[data-hero-card]")
    await expect(hero.locator("[data-hatched]")).toHaveAttribute("aria-valuenow", /\d+/)
    await expect(page.getByTestId("bill-stats").locator("[data-bento-stat]")).toHaveText([/Pagas/, /A pagar/, /Atrasadas/])
    await expect(page.getByTestId("bill-stats").locator("[data-stat-chip]").first()).toContainText(/\d+ contas?/)
    const timeline = page.getByTestId("month-timeline")
    expect(await timeline.locator("[data-day]").count()).toBeGreaterThanOrEqual(28)
    await expect(timeline.locator("[data-today]")).toHaveCount(1)
    expect(await computed(timeline.locator("[data-today]"), "background-color")).not.toMatch(/rgba\(0, 0, 0, 0\)/)
    const withDot = timeline.locator("[data-day]").filter({ has: page.locator("[data-dot]") }).first()
    const day = await withDot.getAttribute("data-day")
    await withDot.click()
    await expect(withDot).toHaveAttribute("aria-pressed", "true")
    const badges = await page.getByTestId("bills-main").locator("[data-bill] [data-day-badge]").evaluateAll((els) => els.map((e) => e.textContent?.replace(/\D/g, "")))
    expect(badges.length).toBeGreaterThan(0)
    expect(badges.every((b) => b === day)).toBe(true)
    await withDot.click()
    expect(await page.getByTestId("bills-main").locator("[data-bill]").count()).toBeGreaterThan(badges.length - 1)
    // Lista | Linha.
    const seg = page.getByRole("group", { name: "Modo de exibição" })
    await seg.getByRole("button", { name: "Lista" }).click()
    await expect(timeline).toHaveCount(0)
    await seg.getByRole("button", { name: "Linha" }).click()
    await expect(page.getByTestId("month-timeline")).toBeVisible()
    // Right column and groups.
    await expect(page.getByLabel("Fixas por categoria").locator("[data-segment]").first()).toBeVisible()
    await expect(page.getByLabel("Próximos vencimentos").locator("[data-next-due]")).toHaveCount(3)
    const main = page.getByTestId("bills-main")
    await expect(main.locator("[data-group=paid] [data-group-header]")).toHaveAttribute("aria-expanded", "false")
    await main.locator("[data-bill]").filter({ hasText: "Energia elétrica" }).getByRole("button", { name: "Pagar" }).click()
    await expect(page.getByText("Energia elétrica paga.")).toBeVisible()
    await expect(main.locator("[data-group=paid] [data-group-header]")).toContainText("3")
    await undoBtn(page).click()
    await expect(main.locator("[data-group=paid] [data-group-header]")).toContainText("2")
  })

  test("Metas: featured dark card, neighbours, sparkline only after a contribution, create / edit / Guardar, achieved collapsed", async ({ page }) => {
    await open(page, "Metas")
    await expect(page.getByLabel("Guardado nas metas").first().locator("[data-hatched]")).toHaveCount(1)
    await expect(page.getByTestId("goal-stats").locator("[data-bento-stat]")).toHaveText([/Falta guardar/, /Aporte por mês/, /Próximo prazo/])
    const featured = page.locator("[data-featured]")
    await expect(featured).toContainText("Viagem de fim de ano")
    expect(await computed(featured, "background-color")).not.toMatch(/rgba\(0, 0, 0, 0\)/)
    await expect(featured.getByRole("progressbar")).toHaveAttribute("aria-valuenow", /\d+/)
    await expect(featured.locator("[data-sparkline]")).toHaveCount(0)
    await expect(page.locator("[data-goal][data-done=false]")).toHaveCount(2)
    // Featured Guardar: the sparkline appears (there is history now) and goes with Desfazer.
    await featured.getByRole("button", { name: "Guardar" }).click()
    await page.getByRole("dialog").getByLabel("Valor", { exact: true }).fill("100")
    await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click()
    await expect(featured.locator("[data-sparkline]")).toBeVisible()
    await undoBtn(page).click()
    await expect(featured.locator("[data-sparkline]")).toHaveCount(0)
    // Achieved.
    const done = page.locator("[data-group=done]")
    await expect(done.locator("[data-group-header]")).toHaveAttribute("aria-expanded", "false")
    await done.locator("[data-group-header]").click()
    await expect(done).toContainText("Meta alcançada")
    await expect(done.getByRole("button", { name: "Guardar" })).toBeDisabled()
    // Create, edit.
    await page.getByText("Nova meta…").click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Nome").fill("Moto nova")
    await dialog.getByLabel("Valor da meta").fill("9000")
    await dialog.getByRole("radio", { name: "Carro" }).click()
    await dialog.getByRole("button", { name: "Criar meta" }).click()
    const goal = page.locator("[data-goal]").filter({ hasText: "Moto nova" })
    await expect(goal).toContainText("R$ 0,00 de R$ 9.000,00")
    await goal.getByRole("button", { name: /^Ações de/ }).click()
    await page.getByRole("menuitem", { name: "Editar" }).click()
    await page.getByRole("dialog").getByLabel("Nome").fill("Moto 0km")
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click()
    await expect(page.locator("[data-goal]").filter({ hasText: "Moto 0km" })).toHaveCount(1)
    await page.locator("[data-goal]").filter({ hasText: "Moto 0km" }).getByRole("button", { name: "Guardar" }).click()
    await expect(page.getByRole("dialog")).toContainText("Faltam R$ 9.000,00 para chegar lá.")
    await page.getByRole("dialog").locator("[data-suggestion]").filter({ hasText: "R$ 500,00" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click()
    await expect(page.locator("[data-goal]").filter({ hasText: "Moto 0km" })).toContainText("R$ 500,00 de R$ 9.000,00")
  })

  test("dialogs on desktop: modal radius 20, Esc, Enter submits, inline message", async ({ page }) => {
    await open(page, "Lançamentos")
    const main = page.getByTestId("transactions-main")
    await main.getByRole("searchbox", { name: "Buscar lançamentos" }).fill("zzz")
    await main.getByRole("button", { name: "Novo lançamento" }).click()
    const dialog = page.getByRole("dialog")
    expect(parseFloat(await computed(dialog, "border-top-left-radius"))).toBe(20)
    await expect(dialog.getByLabel("Descrição")).toBeFocused()
    await dialog.getByLabel("Descrição").fill("Teste")
    await dialog.getByLabel("Descrição").press("Enter")
    await expect(dialog.getByText("Informe um valor maior que zero.")).toBeVisible()
    await dialog.getByLabel("Valor", { exact: true }).fill("12,30")
    await dialog.getByLabel("Valor", { exact: true }).press("Enter")
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText("Gasto registrado.")).toBeVisible()
    await page.getByRole("tab", { name: "Contas fixas", exact: true }).click()
    await page.getByText("Nova conta fixa…").click()
    await expect(page.getByRole("dialog")).toContainText("Vence todo mês e entra em “A pagar”.")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })
})

test.describe("widths 768–1920", () => {
  test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))
  for (const width of [768, 1024, 1280, 1920]) {
    test(`every tab fits at ${width}: no page scroll and no card overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await open(page)
      for (const tab of ["Visão geral", "Lançamentos", "Contas fixas", "Metas"] as const) {
        await page.getByRole("tab", { name: tab, exact: true }).click()
        await page.waitForTimeout(250)
        expect(await noPageScroll(page)).toBe(true)
        expect(await noCardOverflow(page)).toEqual([])
      }
    })
  }

  test("grid collapses: 8 columns at 1100 (hero full width), two-up stats and one column at 800", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 })
    await open(page)
    const grid = page.getByTestId("overview-grid")
    const hero = (await grid.locator("[data-hero-card]").boundingBox())!
    const stats = (await page.getByTestId("stat-grid").boundingBox())!
    expect(stats.y).toBeGreaterThan(hero.y + hero.height - 2)
    expect(Math.abs(hero.width - stats.width)).toBeLessThan(4)
    const cols = (await computed(page.getByTestId("stat-grid"), "grid-template-columns")).split(" ").length
    expect(cols).toBe(2)
    await page.setViewportSize({ width: 800, height: 900 })
    await page.waitForTimeout(200)
    const flow = (await page.getByTestId("cashflow-card").boundingBox())!
    const watch = (await page.getByTestId("watch-list").boundingBox())!
    expect(watch.y).toBeGreaterThan(flow.y + flow.height - 2)
  })
})

for (const [label, size] of [["360", { width: 360, height: 780 }], ["390", { width: 390, height: 844 }], ["430", { width: 430, height: 932 }]] as const) {
  for (const theme of ["dark", "light"]) {
    test.describe(`phone ${label} ${theme}`, () => {
      test.use({ viewport: size, hasTouch: true })
      test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!, theme))

      test("every tab fits; carousels scroll inside their card, never the page; tiles do not overflow; 90px of room below", async ({ page }) => {
        await open(page)
        const tablist = page.getByRole("tablist", { name: "Finanças" })
        await expect(tablist.getByRole("tab")).toHaveText(["Geral", "Lançamentos", "Fixas", "Metas"])
        for (const tab of ["Visão geral", "Lançamentos", "Contas fixas", "Metas"] as const) {
          await page.getByRole("tab", { name: SHORT[tab], exact: true }).click()
          await page.waitForTimeout(300)
          expect(await noPageScroll(page)).toBe(true)
          expect(await tablist.getByRole("tab").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length)).toBe(0)
          expect(await page.locator("[data-bento-stat]").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length)).toBe(0)
          expect(await noCardOverflow(page)).toEqual([])
        }
        await page.getByRole("tab", { name: "Geral", exact: true }).click()
        for (const id of ["accounts-carousel", "goals-carousel"]) {
          const carousel = page.getByTestId(id)
          expect(await carousel.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
          expect(await carousel.evaluate((el) => el.className)).toContain("scroll-soft")
          await carousel.evaluate((el) => (el.scrollLeft = 120))
          expect(await noPageScroll(page)).toBe(true)
        }
        expect(await page.getByTestId("financas").evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom))).toBeGreaterThanOrEqual(90)
      })

      test("contrast: Lima hero with Tinta text, income text, active pills reach 4.5:1", async ({ page }) => {
        await open(page, "Visão geral", true)
        const hero = page.locator("[data-hero-card]")
        expect(await contrast(page, await computed(hero, "color"), await computed(hero, "background-color"))).toBeGreaterThan(4.5)
        const pill = page.getByRole("tab", { name: "Geral", exact: true })
        expect(await contrast(page, await computed(pill, "color"), await computed(pill, "background-color"))).toBeGreaterThan(4.5)
        await page.getByRole("tab", { name: "Lançamentos", exact: true }).click()
        await expect(page.locator("[data-money][data-tone=in]").first()).toBeVisible()
        const income = page.locator("[data-money][data-tone=in]").first()
        const card = income.locator("xpath=ancestor::div[contains(@class,'rounded-[14px]')][1]")
        expect(await contrast(page, await computed(income, "color"), await computed(card, "background-color"))).toBeGreaterThan(4.5)
      })
    })
  }
}

test.describe("phone behaviors", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

  test("Visão geral: order of cards, 2x2 stats, chart month by tap, Pagar, Últimas movimentações", async ({ page }) => {
    await open(page)
    const order = await page.locator("[data-testid=overview-grid] > section[aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))
    expect(order).toEqual(["Saldo total", "Contas e bancos", "Orçamento do mês", "Fluxo de caixa", "Para ficar de olho", "Metas", "Últimas movimentações"])
    const tiles = await page.getByTestId("stat-grid").locator("[data-bento-stat]").evaluateAll((els) => els.map((e) => [Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().top)]))
    expect(new Set(tiles.map((t) => t[0])).size).toBe(2)
    expect(new Set(tiles.map((t) => t[1])).size).toBe(2)
    await expect(page.getByTestId("budget-card").locator("[data-category-card]")).toHaveCount(3)
    const chart = page.getByTestId("cashflow-chart")
    await chart.locator("[data-month]").first().tap()
    await expect(chart.locator("[data-month]").first()).toHaveAttribute("aria-pressed", "true")
    expect(Math.round((await chart.boundingBox())!.height)).toBe(170)
    const watch = page.getByTestId("watch-list")
    const bill = watch.locator("[data-bill]").filter({ hasText: "Energia elétrica" })
    const [title, amount, pill] = [await bill.locator("[data-item-title]").boundingBox(), await bill.locator("[data-money]").boundingBox(), await bill.getByRole("button", { name: "Pagar" }).boundingBox()]
    expect(Math.abs(title!.y - amount!.y)).toBeLessThan(8)
    expect(pill!.y).toBeGreaterThan(title!.y + title!.height - 2)
    await bill.getByRole("button", { name: "Pagar" }).click()
    await expect(page.getByText("Energia elétrica paga.")).toBeVisible()
    await undoBtn(page).click()
    await expect(page.getByTestId("recent-card").locator("[data-transaction]")).toHaveCount(3)
    await page.getByTestId("recent-card").getByRole("button", { name: "Ver todas" }).click()
    await expect(page.getByRole("tab", { name: "Lançamentos", exact: true })).toHaveAttribute("aria-selected", "true")
  })

  test("Lançamentos: hero + 2 tiles, filter row scrolls, quick add under it, swipe left deletes, filter sheet with count", async ({ page }) => {
    await open(page, "Lançamentos", true)
    await expect(page.locator("[data-hero-card]")).toContainText("Saídas do mês")
    await expect(page.getByTestId("transaction-tiles").locator("[data-bento-stat]")).toHaveCount(2)
    const row = page.getByTestId("filter-row")
    expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
    expect(await row.evaluate((el) => el.className)).toContain("scroll-soft")
    expect(await noPageScroll(page)).toBe(true)
    const rowY = (await row.boundingBox())!.y
    expect((await page.locator("[data-add-task-pill]").first().boundingBox())!.y).toBeGreaterThan(rowY)
    const tx = page.locator("[data-transaction]").filter({ hasText: "Padaria da esquina" })
    await swipe(tx, -160)
    await expect(page.getByText("Lançamento excluído.")).toBeVisible()
    await undoBtn(page).click()
    await expect(tx).toHaveCount(1)
    await page.getByRole("button", { name: "Filtros" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Saídas", exact: true }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Ver lançamentos" }).click()
    await expect(page.getByRole("button", { name: "Filtros, 1 ativos" })).toBeVisible()
    await page.getByRole("button", { name: "Buscar lançamentos" }).click()
    await expect(page.getByRole("searchbox", { name: "Buscar lançamentos" })).toBeVisible()
  })

  test("Contas fixas: hero, two tiles, day chips filter the list, two-line cards with swipe", async ({ page }) => {
    await open(page, "Contas fixas", true)
    await expect(page.locator("[data-hero-card] [data-hatched]")).toHaveCount(1)
    await expect(page.getByTestId("bill-stats").locator("[data-bento-stat]")).toHaveText([/Pagas/, /Atrasadas/])
    const timeline = page.getByTestId("month-timeline")
    const chip = timeline.locator("[data-day]").first()
    expect(Math.round((await chip.boundingBox())!.width)).toBe(44)
    expect(await timeline.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
    expect(await computed(timeline, "scroll-snap-type")).toContain("x")
    expect(await noPageScroll(page)).toBe(true)
    const withDot = timeline.locator("[data-day]").filter({ has: page.locator("[data-dot]") }).first()
    const day = await withDot.getAttribute("data-day")
    await withDot.tap()
    const badges = await page.getByTestId("bills-main").locator("[data-bill] [data-day-badge]").evaluateAll((els) => els.map((e) => e.textContent?.replace(/\D/g, "")))
    expect(badges.length).toBeGreaterThan(0)
    expect(badges.every((b) => b === day)).toBe(true)
    await withDot.tap()
    const bill = page.locator("[data-bill]").filter({ hasText: "Plano de saúde" })
    const [title, amount, pill] = [await bill.locator("[data-item-title]").boundingBox(), await bill.locator("[data-money]").boundingBox(), await bill.getByRole("button", { name: "Pagar" }).boundingBox()]
    expect(Math.abs(title!.y - amount!.y)).toBeLessThan(8)
    expect(pill!.y).toBeGreaterThan(title!.y + title!.height - 2)
    await swipe(bill, 160)
    await expect(page.getByText("Plano de saúde paga.")).toBeVisible()
    await undoBtn(page).click()
    await swipe(bill, -160)
    await expect(page.getByText("Conta fixa excluída.")).toBeVisible()
    await undoBtn(page).click()
    await expect(bill).toHaveCount(1)
  })

  test("Metas: hero, two tiles, dashed pill, featured card with a 44px Lima Guardar, compact rows with a circle +, achieved collapsed", async ({ page }) => {
    await open(page, "Metas", true)
    await expect(page.locator("[data-hero-card] [data-hatched]")).toHaveCount(1)
    await expect(page.getByTestId("goal-stats").locator("[data-bento-stat]")).toHaveCount(2)
    await expect(page.getByText("Nova meta…")).toBeVisible()
    const featured = page.locator("[data-featured]")
    const guardar = featured.getByRole("button", { name: "Guardar" })
    expect(Math.round((await guardar.boundingBox())!.height)).toBeGreaterThanOrEqual(44)
    const rows = page.locator("[data-group=active] [data-goal]:not([data-featured])")
    await expect(rows).toHaveCount(2)
    const ring = await rows.first().getByRole("progressbar").boundingBox()
    expect(Math.round(ring!.width)).toBe(72)
    const plus = await rows.first().getByRole("button", { name: /^Guardar em/ }).boundingBox()
    expect(plus!.width).toBeGreaterThanOrEqual(44)
    await expect(page.locator("[data-group=done] [data-group-header]")).toHaveAttribute("aria-expanded", "false")
    expect(await noPageScroll(page)).toBe(true)
  })

  test("dialogs on phones: bottom sheet, primary action in view", async ({ page }) => {
    await open(page, "Lançamentos", true)
    await page.getByRole("button", { name: "Buscar lançamentos" }).click()
    await page.getByRole("searchbox", { name: "Buscar lançamentos" }).fill("zzz")
    await page.getByRole("button", { name: "Novo lançamento" }).click()
    const sheet = page.locator("[data-vaul-drawer]")
    await expect(sheet.getByRole("heading", { name: "Novo lançamento" })).toBeVisible()
    await page.waitForTimeout(800)
    const box = await sheet.getByRole("button", { name: "Salvar" }).boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
    await sheet.getByRole("button", { name: "Cancelar" }).click()
    await expect(sheet).toHaveCount(0)
  })
})
