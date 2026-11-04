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
    // Hero: no buttons any more, only the arrow circle and the balance chart.
    const heroEl = grid.locator("[data-hero-card]")
    await expect(heroEl.getByRole("button", { name: "Transferir" })).toHaveCount(0)
    await expect(heroEl.getByRole("button", { name: "Pagar conta" })).toHaveCount(0)
    await expect(heroEl.getByTestId("balance-chart")).toBeVisible()
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
    await expect(seg.getByRole("button")).toHaveText([/^Todos\s*\d+$/, /^Entradas\s*\d+$/, /^Saídas\s*\d+$/])
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

  test("Contas fixas: hero with progress, stats, month timeline with Todos | Dia filtering the list, Pagar + Desfazer", async ({ page }) => {
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
    await expect(page.getByRole("group", { name: "Filtro da linha do mês" }).getByRole("button", { name: "Dia" })).toHaveAttribute("aria-pressed", "true")
    const badges = await page.getByTestId("bills-main").locator("[data-bill] [data-day-badge]").evaluateAll((els) => els.map((e) => e.textContent?.replace(/\D/g, "")))
    expect(badges.length).toBeGreaterThan(0)
    expect(badges.every((b) => b === day)).toBe(true)
    // Todos | Dia: the timeline stays; "Dia" starts on today and an empty day says so.
    const seg = page.getByRole("group", { name: "Filtro da linha do mês" })
    await expect(seg.getByRole("button")).toHaveText(["Todos", "Dia"])
    await seg.getByRole("button", { name: "Todos" }).click()
    await expect(seg.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true")
    await seg.getByRole("button", { name: "Dia" }).click()
    await expect(timeline.locator("[data-today]")).toHaveAttribute("aria-pressed", "true")
    await expect(timeline).toBeVisible()
    const empty = timeline.locator("[data-day]").filter({ hasNot: page.locator("[data-dot]") }).nth(2)
    await empty.click()
    await expect(page.getByTestId("bills-main")).toContainText("Nenhuma conta vence neste dia")
    await expect(page.getByTestId("bills-main").getByRole("button", { name: "Nova conta fixa…" })).toBeVisible()
    await seg.getByRole("button", { name: "Todos" }).click()
    await expect(timeline.locator("[aria-pressed=true]")).toHaveCount(0)
    expect(await page.getByTestId("bills-main").locator("[data-bill]").count()).toBeGreaterThan(badges.length - 1)
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
    await expect(page.locator("[data-goal][data-done=false]")).toHaveCount(3)
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
    await expect(done.getByRole("button", { name: "Guardar" })).toHaveCount(0)
    await expect(done.locator("[data-goal] [data-category-circle], [data-goal] svg:not([role=progressbar] svg)")).toHaveCount(0)
    // Create, edit.
    await page.getByRole("button", { name: "Nova meta" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Nome").fill("Moto nova")
    await dialog.getByLabel("Valor da meta").fill("9000")
    await dialog.getByRole("radio", { name: "Carro" }).click()
    await dialog.getByRole("button", { name: "Criar meta" }).click()
    const goal = page.locator("[data-goal]").filter({ hasText: "Moto nova" })
    await expect(goal).toContainText(/R\$ 0,00\s*de R\$ 9\.000,00/)
    await goal.getByRole("button", { name: /^Ações de/ }).click()
    await page.getByRole("menuitem", { name: "Editar" }).click()
    await page.getByRole("dialog").getByLabel("Nome").fill("Moto 0km")
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click()
    await expect(page.locator("[data-goal]").filter({ hasText: "Moto 0km" })).toHaveCount(1)
    await page.locator("[data-goal]").filter({ hasText: "Moto 0km" }).getByRole("button", { name: "Guardar" }).click()
    await expect(page.getByRole("dialog")).toContainText("Faltam R$ 9.000,00 para chegar lá.")
    await page.getByRole("dialog").locator("[data-suggestion]").filter({ hasText: "R$ 500,00" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click()
    await expect(page.locator("[data-goal]").filter({ hasText: "Moto 0km" })).toContainText(/R\$ 500,00\s*de R\$ 9\.000,00/)
  })

  test("Lançamentos: ONE solid toolbar card (quick add, kinds, categories with Editar, search, Filtros, Ordem)", async ({ page }) => {
    await open(page, "Lançamentos")
    const bar = page.getByTestId("transactions-toolbar")
    expect(parseFloat(await computed(bar, "border-top-left-radius"))).toBe(20)
    expect(await computed(bar, "background-color")).not.toMatch(/rgba\(0, 0, 0, 0\)/)
    expect(parseFloat(await computed(bar, "border-top-width"))).toBe(1)
    await expect(bar.locator("[data-add-task-pill]")).toBeVisible()
    await expect(bar.getByRole("group", { name: "Filtrar por tipo" })).toBeVisible()
    const cats = bar.getByRole("group", { name: "Filtrar por categoria" })
    await expect(cats.getByRole("button", { name: /^Mercado\s*\d+$/ })).toBeVisible()
    await expect(bar.getByRole("button", { name: "Editar categorias" })).toBeVisible()
    // Search circle expands inline and filters.
    await bar.getByRole("button", { name: "Buscar lançamentos" }).click()
    const search = bar.getByRole("searchbox", { name: "Buscar lançamentos" })
    await search.fill("padaria")
    await expect(page.getByTestId("transactions-main").locator("[data-transaction]")).toHaveCount(1)
    await search.fill("")
    // Filtros popover: kind and category, with a count badge.
    await bar.getByRole("button", { name: /^Filtros/ }).click()
    await page.getByRole("button", { name: "Saídas", exact: false }).last().click()
    await expect(bar.getByRole("button", { name: /^Filtros/ })).toContainText("1")
    await page.keyboard.press("Escape")
    // Ordem: Data (default), Maior valor.
    await bar.getByRole("combobox", { name: "Ordenar" }).click()
    await page.getByRole("option", { name: "Maior valor" }).click()
    await expect(bar.getByRole("combobox", { name: "Ordenar" })).toContainText("Maior valor")
    // "Editar" opens the picker with Gerenciar / Adicionar.
    await bar.getByRole("button", { name: "Editar categorias" }).click()
    await expect(page.getByRole("dialog")).toContainText("Categorias")
    await expect(page.getByRole("dialog").getByRole("button", { name: /Gerenciar/ })).toBeVisible()
    await page.keyboard.press("Escape")
  })

  test("Lançamentos: the most recent day starts open, the others closed, and toggles are remembered", async ({ page }) => {
    await open(page, "Lançamentos")
    const groups = page.getByTestId("transactions-main").locator("[data-day-group]")
    const headers = groups.locator("[data-group-header]")
    expect(await groups.count()).toBeGreaterThan(2)
    await expect(headers.first()).toHaveAttribute("aria-expanded", "true")
    await expect(headers.nth(1)).toHaveAttribute("aria-expanded", "false")
    await expect(headers.nth(2)).toHaveAttribute("aria-expanded", "false")
    await headers.nth(1).click()
    await headers.first().click()
    await page.getByRole("tab", { name: "Metas", exact: true }).click()
    await page.getByRole("tab", { name: "Lançamentos", exact: true }).click()
    await expect(headers.first()).toHaveAttribute("aria-expanded", "false")
    await expect(headers.nth(1)).toHaveAttribute("aria-expanded", "true")
  })

  test("Metas: Destacar and drag reorder change the featured goal and the order survives a reload", async ({ page }) => {
    await open(page, "Metas")
    const featured = page.locator("[data-featured]")
    await expect(featured).toContainText("Viagem de fim de ano")
    // "+ Nova meta" is the pill of the Em andamento header; there is no dashed tile in the grid or in Alcançadas.
    await expect(page.locator("[data-group=active] [data-group-header]").locator("xpath=..").locator("[data-new-goal]")).toHaveCount(1)
    await expect(page.locator("[data-group=active] [data-group-rows] [data-new-goal]")).toHaveCount(0)
    await expect(page.locator("[data-group=done] [data-new-goal]")).toHaveCount(0)
    // Destacar (menu).
    const reserva = page.locator("[data-goal]").filter({ hasText: "Reserva de emergência" })
    await reserva.getByRole("button", { name: /^Ações de/ }).click()
    await page.getByRole("menuitem", { name: "Destacar" }).click()
    await expect(featured).toContainText("Reserva de emergência")
    await page.reload()
    await page.getByRole("tab", { name: "Metas", exact: true }).click()
    await expect(page.locator("[data-featured]")).toContainText("Reserva de emergência")
    // Keyboard reorder: Space picks up, an arrow moves, Space drops; the goal in the first slot is featured.
    const apartamento = page.locator("[data-sortable-goal]").filter({ hasText: "Entrada do apartamento" })
    const grip = apartamento.getByRole("button", { name: "Reordenar Entrada do apartamento" })
    await grip.focus()
    await page.keyboard.press("Space")
    await page.waitForTimeout(250)
    await page.keyboard.press("ArrowLeft")
    await page.waitForTimeout(400)
    await page.keyboard.press("ArrowLeft")
    await page.waitForTimeout(400)
    await page.keyboard.press("Space")
    await expect(page.locator("[data-featured]")).toContainText("Entrada do apartamento")
    await expect(page.locator("[role=status]").filter({ hasText: "posição" }).first()).toBeAttached()
    // Mouse drag of a grip onto the first card.
    const second = page.locator("[data-sortable-goal]").nth(1)
    const g2 = (await second.getByRole("button", { name: /^Reordenar/ }).boundingBox())!
    const first = (await page.locator("[data-sortable-goal]").first().boundingBox())!
    await page.mouse.move(g2.x + g2.width / 2, g2.y + g2.height / 2)
    await page.mouse.down()
    await page.mouse.move(first.x + 40, first.y + 40, { steps: 12 })
    await page.mouse.up()
    await expect(page.locator("[data-featured]")).not.toContainText("Entrada do apartamento")
  })

  test("Lançamentos: categories share the row of Todos | Entradas | Saídas, scroll with chevrons, Editar stays pinned", async ({ page }) => {
    await open(page, "Lançamentos")
    const bar = page.getByTestId("transactions-toolbar")
    const kinds = bar.getByRole("group", { name: "Filtrar por tipo" })
    const cats = bar.getByRole("group", { name: "Filtrar por categoria" })
    const edit = bar.getByRole("button", { name: "Editar categorias" })
    const [k, c, e] = [(await kinds.boundingBox())!, (await cats.boundingBox())!, (await edit.boundingBox())!]
    expect(Math.abs(k.y + k.height / 2 - (c.y + c.height / 2))).toBeLessThan(6)
    expect(c.x).toBeGreaterThan(k.x + k.width)
    expect(e.x).toBeGreaterThanOrEqual(c.x + c.width - 2)
    // No visible scrollbar: the pills row hides it.
    expect(await cats.evaluate((el) => el.className)).toContain("no-scrollbar")
    expect(await cats.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
    const right = bar.getByRole("button", { name: "Rolar categorias para a direita" })
    await expect(right).toBeVisible()
    await expect(bar.getByRole("button", { name: "Rolar categorias para a esquerda" })).toHaveCount(0)
    await right.click()
    await expect(bar.getByRole("button", { name: "Rolar categorias para a esquerda" })).toBeVisible()
    expect(await cats.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    // Mouse wheel scrolls it too, and the dashed pill is still in view.
    await cats.hover()
    await page.mouse.wheel(0, 200)
    await expect(edit).toBeInViewport()
    // The active pill is Lima and keeps its count.
    const pill = cats.getByRole("button", { name: /^Mercado\s*\d+$/ })
    await pill.scrollIntoViewIfNeeded()
    await pill.click()
    await expect(pill).toHaveAttribute("aria-pressed", "true")
    expect(await computed(pill, "background-color")).not.toMatch(/rgba\(0, 0, 0, 0\)/)
  })

  test("category donut: segments add up, start at 12 o'clock, the center text fits inside the ring (Lançamentos and Contas fixas)", async ({ page }) => {
    for (const [tab, scope] of [["Lançamentos", page.locator("aside")], ["Contas fixas", page.getByLabel("Fixas por categoria")]] as const) {
      await open(page, tab)
      const donut = scope.getByTestId("category-donut")
      await expect(donut.locator("[data-segment]").first()).toBeVisible()
      const shares = await donut.locator("[data-segment]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-share"))))
      expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2)
      expect([...shares].sort((a, b) => b - a)).toEqual(shares)
      // The legend is in the same order (biggest first) and the ring rotates -90°.
      const legend = await donut.locator("[data-legend]").evaluateAll((els) => els.map((e) => e.getAttribute("data-legend")))
      expect(legend).toEqual(await donut.locator("[data-segment]").evaluateAll((els) => els.map((e) => e.getAttribute("data-segment"))))
      expect(await donut.locator("svg").evaluate((el) => getComputedStyle(el).rotate)).toBe("-90deg")
      // Center text inside the inner diameter (136px ring, 16px stroke ≈ 82px inside).
      const ring = (await donut.locator("[role=img]").boundingBox())!
      const inner = ring.width * (1 - 32 / 120)
      for (const el of await donut.locator("[role=img] span span").all()) {
        const box = (await el.boundingBox())!
        expect(box.width).toBeLessThanOrEqual(inner + 1)
        expect(box.x).toBeGreaterThanOrEqual(ring.x + (ring.width - inner) / 2 - 1)
        expect(box.x + box.width).toBeLessThanOrEqual(ring.x + (ring.width + inner) / 2 + 1)
      }
    }
  })

  test("the four top cards of Contas fixas and Metas share one row and exactly one height (168px)", async ({ page }) => {
    for (const tab of ["Contas fixas", "Metas"] as const) {
      await open(page, tab)
      const cards = page.locator("[data-hero-card], [data-bento-stat]")
      await expect(cards).toHaveCount(4)
      const boxes = await cards.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ y: Math.round(r.y), h: Math.round(r.height) })))
      expect(new Set(boxes.map((b) => b.y)).size).toBe(1)
      expect(new Set(boxes.map((b) => b.h))).toEqual(new Set([168]))
    }
  })

  test("Metas: + Nova meta is the dashed add pill in the Em andamento header, goal cards share the full structure", async ({ page }) => {
    await open(page, "Metas")
    const header = page.locator("[data-group=active] [data-group-header]")
    const pill = page.getByRole("button", { name: "Nova meta" })
    await expect(page.locator("[data-new-goal]")).toHaveCount(1)
    const [h, p] = [(await header.boundingBox())!, (await pill.boundingBox())!]
    expect(Math.abs(h.y + h.height / 2 - (p.y + p.height / 2))).toBeLessThan(6)
    expect(p.x).toBeGreaterThan(h.x + h.width)
    expect(Math.round(p.height)).toBe(36)
    expect(parseFloat(await computed(pill, "border-top-left-radius"))).toBeGreaterThan(100)
    // The shared dashed add pill (not Lima): dashed border, translucent fill, 14px/600 text.
    expect(await computed(pill, "border-top-style")).toBe("dashed")
    expect(await computed(pill, "font-weight")).toBe("600")
    expect(await computed(pill, "background-color")).not.toBe(await computed(page.getByRole("button", { name: "Guardar" }).first(), "background-color"))
    expect(await computed(pill, "background-color")).toMatch(/rgba?(.*0.0d*)|oklab|color-mix|rgba/)
    // Featured spans half of the grid, the others a quarter; the cards of a row share one height.
    const cards = page.locator("[data-group=active] [data-goal]")
    await expect(cards).toHaveCount(3)
    const [a, b, c] = await Promise.all([0, 1, 2].map(async (i) => (await cards.nth(i).boundingBox())!))
    expect(a.width / b.width).toBeGreaterThan(1.8)
    expect(Math.abs(b.width - c.width)).toBeLessThan(2)
    expect(Math.abs(a.height - b.height)).toBeLessThan(2)
    expect(Math.abs(b.height - c.height)).toBeLessThan(2)
    for (let i = 0; i < 3; i += 1) {
      const card = cards.nth(i)
      await expect(card.getByRole("progressbar")).toHaveCount(1)
      await expect(card.getByRole("button", { name: /^Ações de/ })).toBeVisible()
      await expect(card.getByRole("button", { name: "Guardar" })).toBeVisible()
      await expect(card.locator("[data-sparkline], [data-spark-empty]")).toHaveCount(1)
    }
    // No history: the flat baseline and its caption; the compact ring is 80px.
    await expect(cards.nth(1).locator("[data-spark-empty]")).toContainText("Sem aportes ainda")
    expect(Math.round((await cards.nth(1).getByRole("progressbar").boundingBox())!.width)).toBe(80)
    expect(Math.round((await cards.nth(0).getByRole("progressbar").boundingBox())!.width)).toBe(120)
  })

  test("Visão geral: Contas e bancos is manageable (edit, rename, archive, reorder, delete with and without lançamentos)", async ({ page }) => {
    await open(page)
    const card = page.getByTestId("accounts-card")
    await expect(card.locator("[data-wallet]")).toHaveCount(4)
    // Edit from the wallet: tap opens the dialog with the kind and color.
    await card.locator("[data-wallet]").filter({ hasText: "Carteira" }).locator("[data-wallet-open]").click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Editar conta")
    await dialog.getByLabel("Nome").fill("Carteira de bolso")
    await dialog.getByRole("radiogroup", { name: "Tipo da conta" }).getByRole("radio", { name: "Carteira" }).click()
    await dialog.getByRole("radio", { name: "Lima verso" }).click()
    await dialog.getByRole("button", { name: "Salvar" }).click()
    await expect(card.locator("[data-wallet]").filter({ hasText: "Carteira de bolso" })).toHaveCount(1)
    // Manager: rename inline, archive (hidden from the wallets and the totals), show archived, reactivate.
    await card.getByRole("button", { name: "Gerenciar" }).click()
    const manager = page.getByTestId("account-manager")
    const row = manager.locator("[data-manager-account]").filter({ hasText: "Carteira de bolso" })
    await row.getByRole("button", { name: /^Ações de/ }).click()
    await page.getByRole("menuitem", { name: "Renomear" }).click()
    const field = manager.getByRole("textbox", { name: /Novo nome/ })
    await field.fill("Bolso")
    await field.press("Enter")
    await expect(manager.locator("[data-manager-account]").filter({ hasText: "Bolso" })).toHaveCount(1)
    await manager.locator("[data-manager-account]").filter({ hasText: "Bolso" }).getByRole("button", { name: /^Ações de/ }).click()
    await page.getByRole("menuitem", { name: "Arquivar" }).click()
    await expect(manager.locator("[data-manager-account]").filter({ hasText: "Bolso" })).toHaveCount(0)
    await manager.getByRole("switch", { name: "Mostrar arquivadas" }).click()
    await expect(manager.locator("[data-manager-account]").filter({ hasText: "Bolso" })).toContainText("Arquivada")
    await manager.locator("[data-manager-account]").filter({ hasText: "Bolso" }).getByRole("button", { name: /^Ações de/ }).click()
    await page.getByRole("menuitem", { name: "Reativar" }).click()
    // Reorder with the keyboard: the last account goes up.
    const list = manager.locator("[data-manager-account]")
    const names = async () => list.evaluateAll((els) => els.map((e) => e.querySelector("[data-account-name]")?.textContent))
    const before = await names()
    await list.last().getByRole("button", { name: /^Reordenar/ }).focus()
    await page.keyboard.press("Space")
    await page.waitForTimeout(250)
    await page.keyboard.press("ArrowUp")
    await page.waitForTimeout(400)
    await page.keyboard.press("Space")
    await expect.poll(names).not.toEqual(before)
    // Delete one with no lançamentos: confirm + Desfazer (the card shows four wallets; the rest are one tap away in the manager).
    await page.keyboard.press("Escape")
    await card.getByRole("button", { name: "Adicionar conta…" }).click()
    await page.getByRole("dialog").getByLabel("Nome").fill("Temporária")
    await page.getByRole("dialog").getByRole("button", { name: "Adicionar conta" }).click()
    await expect(card.getByRole("button", { name: /Ver todas as 5 contas/ })).toBeVisible()
    await card.getByRole("button", { name: "Gerenciar" }).click()
    const temp = () => page.getByTestId("account-manager").locator("[data-manager-account]").filter({ hasText: "Temporária" })
    await expect(temp()).toHaveCount(1)
    await temp().getByRole("button", { name: /^Ações de/ }).click()
    await page.getByRole("menuitem", { name: "Excluir" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir conta" }).click()
    await expect(temp()).toHaveCount(0)
    // The manager is modal: close it to reach the toast, undo, and look again.
    await page.keyboard.press("Escape")
    await undoBtn(page).click()
    await card.getByRole("button", { name: "Gerenciar" }).click()
    await expect(temp()).toHaveCount(1)
    await page.keyboard.press("Escape")
    // An account with lançamentos: options (archive recommended, move, delete everything by typing the name).
    await card.locator("[data-wallet]").filter({ hasText: "Nubank" }).getByRole("button", { name: /^Ações de/ }).click()
    await page.getByRole("menuitem", { name: "Excluir" }).click()
    const sheet = page.getByRole("dialog")
    await expect(sheet).toContainText("Arquivar (recomendado)")
    await sheet.getByRole("radio", { name: /Excluir conta e lançamentos/ }).click()
    const confirm = sheet.getByRole("button", { name: "Excluir conta e lançamentos" })
    await expect(confirm).toBeDisabled()
    await sheet.getByRole("radio", { name: /Mover os lançamentos/ }).click()
    await sheet.getByRole("combobox").click()
    await page.getByRole("option", { name: "Itaú" }).first().click()
    await sheet.getByRole("button", { name: "Mover e excluir" }).click()
    await expect(card.locator("[data-wallet]").filter({ hasText: "Nubank" })).toHaveCount(0)
  })

  test("Visão geral: category icons are 44px with the bar and percentage aligned across rows", async ({ page }) => {
    await open(page)
    const rows = page.getByTestId("spending-card").locator("[data-category-card]")
    const circles = await rows.locator("[data-category-circle]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)))
    expect(new Set(circles)).toEqual(new Set([44]))
    const bars = await rows.locator("[role=progressbar]").evaluateAll((els) => els.map((e) => [Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().right)]))
    expect(new Set(bars.map((b) => b[0])).size).toBe(1)
    expect(new Set(bars.map((b) => b[1])).size).toBe(1)
  })

  test("Saldo total: evolution + composition chart with a negative account, month by click and keyboard, legend isolate", async ({ page }) => {
    await open(page)
    // Make Carteira negative: its Farmácia expense grows past the balance (R$ 300 opening).
    await page.getByRole("tab", { name: "Lançamentos", exact: true }).click()
    await page.locator("[data-day-group] [data-group-header][aria-expanded=false]").evaluateAll((els) => els.forEach((e) => (e as HTMLElement).click()))
    await page.locator("[data-transaction]").filter({ hasText: "Farmácia" }).locator("[data-item-title]").click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Valor", { exact: true }).fill("900")
    await dialog.getByRole("button", { name: "Salvar" }).click()
    await page.getByRole("tab", { name: "Visão geral", exact: true }).click()

    const hero = page.locator("[data-hero-card]")
    const chart = hero.getByTestId("balance-chart")
    await expect(chart).toBeVisible()
    const months = chart.locator("[data-month]")
    await expect(months).toHaveCount(6)
    await expect(months.last()).toHaveAttribute("aria-pressed", "true")
    // Four accounts, one of them below the baseline; a total dot per month.
    const lastCol = months.last()
    await expect(lastCol.locator("[data-segment]:not([data-negative])")).toHaveCount(3)
    await expect(lastCol.locator("[data-segment][data-negative]")).toHaveCount(1)
    await expect(chart.locator("[data-total-dot]")).toHaveCount(6)
    await expect(chart.getByTestId("balance-plot")).toHaveAttribute("aria-label", /Saldo total em .*: .*composto por .*Carteira − R\$/)
    // Legend: swatch, name, value and % for the selected month; the negative one has no %.
    const legend = chart.getByTestId("balance-legend").locator("li")
    await expect(legend).toHaveCount(4)
    await expect(legend.filter({ hasText: "Carteira" })).toContainText("− R$")
    await expect(legend.filter({ hasText: "Carteira" })).not.toContainText("%")
    await expect(legend.filter({ hasText: "Poupança" })).toContainText("%")
    const before = await chart.getByTestId("balance-legend-month").textContent()
    // Month by click, then by keyboard: tooltip, legend month and the plot's label follow.
    await months.nth(1).click()
    await expect(months.nth(1)).toHaveAttribute("aria-pressed", "true")
    await expect(chart.getByTestId("balance-tooltip")).toContainText("Nubank")
    await expect(chart.getByTestId("balance-tooltip")).toContainText("Carteira")
    await expect(chart.getByTestId("balance-legend-month")).not.toHaveText(before!)
    await months.nth(1).focus()
    await page.keyboard.press("ArrowRight")
    await expect(months.nth(2)).toHaveAttribute("aria-pressed", "true")
    await expect(months.nth(2)).toBeFocused()
    await page.keyboard.press("End")
    await expect(months.last()).toHaveAttribute("aria-pressed", "true")
    await expect(chart.getByTestId("balance-legend-month")).toHaveText(before!)
    // Isolate an account: its segments stay, the others fade; again to undo.
    const nubank = chart.locator("[data-legend-account]").filter({ hasText: "Nubank" })
    await nubank.click()
    await expect(nubank).toHaveAttribute("aria-pressed", "true")
    const opacities = await lastCol.locator("[data-segment]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-segment"), getComputedStyle(e).opacity]))
    expect(new Set(opacities.map((o) => o[1]))).toEqual(new Set(["0.18", "1"]))
    await nubank.click()
    await expect(nubank).toHaveAttribute("aria-pressed", "false")
    expect(new Set(await lastCol.locator("[data-segment]").evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity)))).toEqual(new Set(["1"]))
    // Row 1 stretches: the hero, the stat grid and the budget share one height.
    const heights = await Promise.all([hero, page.getByTestId("stat-grid"), page.getByTestId("budget-card")].map(async (l) => Math.round((await l.boundingBox())!.height)))
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2)
    expect(heights[0]).toBeGreaterThan(300)
    expect(await noCardOverflow(page)).toEqual([])
  })

  test("dialogs on desktop: modal radius 20, Esc, Enter submits, inline message", async ({ page }) => {
    await open(page, "Lançamentos")
    const main = page.getByTestId("transactions-main")
    await main.getByRole("button", { name: "Buscar lançamentos" }).click()
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
        // Only the latest day starts open; open them all to reach the income row.
        await page.locator("[data-day-group] [data-group-header][aria-expanded=false]").evaluateAll((els) => els.forEach((e) => (e as HTMLElement).click()))
        await expect(page.locator("[data-money][data-tone=in]").first()).toBeVisible()
        const income = page.locator("[data-money][data-tone=in]").first()
        const card = income.locator("xpath=ancestor::div[contains(@class,'rounded-[14px]')][1]")
        expect(await contrast(page, await computed(income, "color"), await computed(card, "background-color"))).toBeGreaterThan(4.5)
      })
    })
  }
}

for (const theme of ["dark", "light"]) {
  for (const [label, size] of [["360", { width: 360, height: 780 }], ["390", { width: 390, height: 844 }], ["430", { width: 430, height: 932 }]] as const) {
    test.describe(`phone ${label} ${theme} (round 3)`, () => {
      test.use({ viewport: size, hasTouch: true })
      test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!, theme))

      test("Nova meta is the dashed add pill (44px circle below 420px) and the Saldo total card has chart, legend and no buttons", async ({ page }) => {
        await open(page, "Metas", true)
        const pill = page.getByRole("button", { name: "Nova meta" })
        expect(await computed(pill, "border-top-style")).toBe("dashed")
        expect(parseFloat(await computed(pill, "border-top-left-radius"))).toBeGreaterThan(100)
        const box = (await pill.boundingBox())!
        if (size.width < 420) {
          expect(Math.round(box.width)).toBe(44)
          expect(Math.round(box.height)).toBe(44)
        } else {
          expect(Math.round(box.height)).toBe(36)
          await expect(pill).toContainText("Nova meta")
        }
        // Not Lima: its fill is the translucent foreground, never the highlight color.
        expect(await computed(pill, "background-color")).not.toBe(await computed(page.locator("[data-hero-card]"), "background-color"))
        await page.getByRole("tab", { name: "Geral", exact: true }).click()
        const hero = page.locator("[data-hero-card]")
        await expect(hero.getByRole("button", { name: /Transferir|Pagar conta/ })).toHaveCount(0)
        const chart = hero.getByTestId("balance-chart")
        await expect(chart).toBeVisible()
        const plot = (await chart.getByTestId("balance-plot").boundingBox())!
        expect(plot.height).toBeGreaterThanOrEqual(120)
        expect(plot.height).toBeLessThanOrEqual(150)
        await chart.locator("[data-month]").first().tap()
        await expect(chart.locator("[data-month]").first()).toHaveAttribute("aria-pressed", "true")
        await expect(chart.getByTestId("balance-tooltip")).toBeVisible()
        expect(await noPageScroll(page)).toBe(true)
        expect(await noCardOverflow(page)).toEqual([])
        // Legend in two columns when there is room, one on the narrowest phones.
        const items = await chart.getByTestId("balance-legend").locator("li").evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size)
        expect(items).toBe(size.width >= 390 ? 2 : 1)
        // The 2x2 tiles keep equal heights per row.
        const tiles = await page.getByTestId("stat-grid").locator("[data-bento-stat]").evaluateAll((els) => els.map((e) => [Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().height)]))
        expect(tiles[0][1]).toBe(tiles[1][1])
        expect(tiles[2][1]).toBe(tiles[3][1])
      })
    })
  }
}

test.describe("phone behaviors", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

  test("Visão geral: order of cards, 2x2 stats, chart month by tap, Pagar, Últimas movimentações", async ({ page }) => {
    await open(page)
    const sections = page.locator("[data-testid=overview-grid] > section[aria-label]")
    await expect(sections).toHaveCount(7)
    const order = await sections.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))
    expect(order).toEqual(["Saldo total", "Contas e bancos", "Orçamento", "Fluxo de caixa", "Para ficar de olho", "Metas", "Últimas movimentações"])
    const tiles = await page.getByTestId("stat-grid").locator("[data-bento-stat]").evaluateAll((els) => els.map((e) => [Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().top)]))
    expect(new Set(tiles.map((t) => t[0])).size).toBe(2)
    expect(new Set(tiles.map((t) => t[1])).size).toBe(2)
    await expect(page.getByTestId("budget-card").locator("[data-category-card]")).toHaveCount(3)
    const chart = page.getByTestId("cashflow-chart")
    await chart.locator("[data-month]").first().tap()
    await expect(chart.locator("[data-month]").first()).toHaveAttribute("aria-pressed", "true")
    expect(Math.round((await chart.boundingBox())!.height)).toBe(210)
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

  test("Lançamentos: header card with the filter row, hero + 2 tiles, quick add under them, swipe left deletes, filter sheet with count", async ({ page }) => {
    await open(page, "Lançamentos", true)
    await expect(page.locator("[data-hero-card]")).toContainText("Saídas do mês")
    await expect(page.getByTestId("transaction-tiles").locator("[data-bento-stat]")).toHaveCount(2)
    const row = page.getByTestId("filter-row")
    const pills = row.locator("[data-pill-row]").first()
    expect(await pills.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
    expect(await pills.evaluate((el) => el.className)).toContain("no-scrollbar")
    // The kinds on the first line, the categories on a second one.
    const [kinds, cats] = [(await row.getByRole("group", { name: "Filtrar por tipo" }).boundingBox())!, (await pills.boundingBox())!]
    expect(cats.y).toBeGreaterThan(kinds.y + kinds.height - 2)
    expect(await noPageScroll(page)).toBe(true)
    // The pill rows live in the solid header card, as in Minhas tarefas.
    expect(await row.evaluate((el) => !!el.closest("[data-testid=financas-header-block]"))).toBe(true)
    const rowY = (await row.boundingBox())!.y
    expect((await page.locator("[data-add-task-pill]").first().boundingBox())!.y).toBeGreaterThan(rowY)
    const tx = page.locator("[data-transaction]").filter({ hasText: "Padaria da esquina" })
    await swipe(tx, -160)
    await expect(page.getByText("Lançamento excluído.")).toBeVisible()
    await undoBtn(page).click()
    await expect(tx).toHaveCount(1)
    await page.getByRole("button", { name: "Filtros" }).click()
    await page.getByRole("dialog").getByRole("button", { name: /^Saídas/ }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Ver lançamentos" }).click()
    await expect(page.getByRole("button", { name: "Filtros, 1 ativos" })).toBeVisible()
    await page.getByRole("button", { name: "Buscar lançamentos" }).click()
    await expect(page.getByRole("searchbox", { name: "Buscar lançamentos" })).toBeVisible()
  })

  test("Contas fixas: hero, two tiles, day chips filter the list, two-line cards with swipe", async ({ page }) => {
    await open(page, "Contas fixas", true)
    await expect(page.locator("[data-hero-card] [data-hatched]")).toHaveCount(1)
    await expect(page.getByTestId("bill-stats").locator("[data-bento-stat]")).toHaveText([/Pagas/, /A pagar/, /Atrasadas/])
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
    await page.getByRole("group", { name: "Filtro da linha do mês" }).getByRole("button", { name: "Todos" }).tap()
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

  test("Metas: 2x2 top cards, + Nova meta pill, stacked full goal cards with a 44px Lima Guardar, achieved collapsed", async ({ page }) => {
    await open(page, "Metas", true)
    await expect(page.locator("[data-hero-card] [data-hatched]")).toHaveCount(1)
    await expect(page.getByTestId("goal-stats").locator("[data-bento-stat]")).toHaveCount(3)
    await expect(page.getByRole("button", { name: "Nova meta" })).toBeVisible()
    const featured = page.locator("[data-featured]")
    const guardar = featured.getByRole("button", { name: "Guardar" })
    expect(Math.round((await guardar.boundingBox())!.height)).toBeGreaterThanOrEqual(44)
    const rows = page.locator("[data-group=active] [data-goal]:not([data-featured])")
    await expect(rows).toHaveCount(2)
    const ring = await rows.first().getByRole("progressbar").boundingBox()
    expect(Math.round(ring!.width)).toBe(120)
    const plus = await rows.first().getByRole("button", { name: "Guardar" }).boundingBox()
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
