/**
 * Finanças redesign: tabs and the month toolbar, quick add, day groups, bills (pay + Desfazer, swipes), goals, the dialogs (desktop modal
 * and phone sheet), no horizontal scroll at 360/390/430 and contrast, dark and light.
 * On the development fixture /design-system/financas (every row in memory):
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test financas.spec
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

async function open(page: Page, tab?: "Visão geral" | "Lançamentos" | "Contas fixas" | "Metas", short = false) {
  await page.goto("/design-system/financas")
  await expect(page.getByRole("tablist", { name: "Finanças" })).toBeVisible({ timeout: 60000 })
  if (tab) {
    const names = { "Visão geral": "Geral", Lançamentos: "Lançamentos", "Contas fixas": "Fixas", Metas: "Metas" }
    const target = page.getByRole("tab", { name: short ? names[tab] : tab, exact: true })
    // The first click can land before hydration finishes; click again until the tab is selected.
    await expect(async () => {
      await target.click()
      await expect(target).toHaveAttribute("aria-selected", "true", { timeout: 1500 })
    }).toPass({ timeout: 20000 })
  }
}

const undoBtn = (page: Page) => page.locator("[data-sonner-toast]").first().getByRole("button", { name: "Desfazer" })
const computed = (loc: Locator, prop: string) => loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)

/** A touch swipe (dispatched pointer events, one frame apart) starting at the middle of `loc`. */
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

/** WCAG contrast of two CSS colors, composited through a canvas (handles oklch and color-mix). */
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

const monthName = (offset = 0) => {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 15))
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d).replace(" de ", " de ")
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

  test("PillTabs switch the four tabs; the month toolbar belongs to all but Metas", async ({ page }) => {
    await open(page)
    const tabs = page.getByRole("tablist", { name: "Finanças" }).getByRole("tab")
    await expect(tabs).toHaveText(["Visão geral", "Lançamentos", "Contas fixas", "Metas"])
    const title = page.getByTestId("month-title")
    for (const name of ["Visão geral", "Lançamentos", "Contas fixas"]) {
      await page.getByRole("tab", { name, exact: true }).click()
      await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true")
      await expect(title).toBeVisible()
    }
    await page.getByRole("tab", { name: "Metas", exact: true }).click()
    await expect(title).toHaveCount(0)
    await expect(page.getByText("Nova meta…")).toBeVisible()
    // The month moves and the title returns to this month.
    await page.getByRole("tab", { name: "Visão geral", exact: true }).click()
    await expect(title).toHaveText(new RegExp(`^${monthName(0)}$`, "i"))
    await page.getByRole("button", { name: "Mês anterior" }).click()
    await expect(title).toHaveText(new RegExp(`^${monthName(-1)}$`, "i"))
    await title.click()
    await expect(title).toHaveText(new RegExp(`^${monthName(0)}$`, "i"))
    // Pills: Lima when active.
    expect(await contrast(page, await computed(page.getByRole("tab", { name: "Visão geral", exact: true }), "color"), await computed(page.getByRole("tab", { name: "Visão geral", exact: true }), "background-color"))).toBeGreaterThan(4.5)
  })

  test("Visão geral: KPI row, Saldo do mês keeps its sign, budget + categories inside the card, desktop order", async ({ page }) => {
    await open(page)
    const kpi = page.getByTestId("kpi-row")
    await expect(kpi.locator("[data-hero-card]")).toContainText("Saldo total")
    await expect(kpi.locator("[data-hero-card]")).toContainText("4 contas")
    await expect(kpi.locator("[data-stat-tile]")).toHaveCount(3)
    await expect(kpi).toContainText("entradas menos saídas")
    // The month with no income: the sign must show (the old card hid it with Math.abs).
    await page.getByRole("button", { name: "Mês anterior" }).click()
    await page.getByRole("button", { name: "Mês anterior" }).click()
    await page.getByRole("button", { name: "Mês anterior" }).click()
    await page.getByRole("button", { name: "Mês anterior" }).click()
    await page.getByRole("button", { name: "Mês anterior" }).click()
    await page.getByRole("button", { name: "Mês anterior" }).click()
    await expect(kpi.getByLabel("Saldo do mês")).toContainText("R$ 0,00")
    await page.getByTestId("month-title").click()
    const budget = page.getByTestId("budget-card")
    await expect(budget.getByRole("button", { name: "Editar limites" })).toBeVisible()
    await expect(budget.getByRole("progressbar", { name: "Orçamento usado" })).toHaveAttribute("aria-valuenow", /\d+/)
    await expect(budget).toContainText("Onde estou gastando")
    expect(await budget.locator("[data-category-card]").count()).toBeGreaterThan(3)
    expect(await computed(budget.locator("[data-category-card]").first().locator("..").first(), "display")).toBe("grid")
    await expect(budget.getByText("Acima do limite").or(budget.getByText("Perto do limite")).first()).toBeVisible()
    // Left column: watch list then budget; right column: evolution then accounts.
    const y = async (name: string) => (await page.locator(`section[aria-label="${name}"]`).boundingBox())!
    const [watch, bud, evo, acc] = [await y("Para ficar de olho"), await y("Orçamento do mês"), await y("Evolução nos últimos 6 meses"), await y("Contas e bancos")]
    expect(watch.y).toBeLessThan(bud.y)
    expect(evo.y).toBeLessThan(acc.y)
    expect(evo.x).toBeGreaterThan(watch.x + watch.width)
    await expect(page.getByTestId("spending-list")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Adicionar conta…" }).or(page.getByText("Adicionar conta…"))).toBeVisible()
  })

  test("Para ficar de olho: Pagar shows a toast with Desfazer; Ver todas goes to Contas fixas", async ({ page }) => {
    await open(page)
    const watch = page.getByTestId("watch-list")
    await expect(watch.locator("[data-bill]")).toHaveCount(3)
    await watch.locator("[data-bill]").filter({ hasText: "Energia elétrica" }).getByRole("button", { name: "Pagar" }).click()
    await expect(page.getByText("Energia elétrica paga.")).toBeVisible()
    await expect(watch.locator("[data-bill]")).toHaveCount(2)
    await undoBtn(page).click()
    await expect(watch.locator("[data-bill]")).toHaveCount(3)
    await watch.getByRole("button", { name: "Ver todas" }).click()
    await expect(page.getByRole("tab", { name: "Contas fixas", exact: true })).toHaveAttribute("aria-selected", "true")
  })

  test("Lançamentos: quick add parses 'mercado 45,90' and '+ salário 5000', each with Desfazer", async ({ page }) => {
    await open(page, "Lançamentos")
    const main = page.getByTestId("transactions-main")
    await main.locator("[data-add-task-pill]").click()
    const field = page.getByRole("textbox", { name: "Adicionar lançamento rápido" })
    await field.fill("mercado 45,90")
    await field.press("Enter")
    const row = main.locator("[data-transaction]").filter({ hasText: "R$ 45,90" })
    await expect(row).toContainText("Mercado")
    await expect(row).toContainText("− R$ 45,90")
    await expect(page.getByText("Gasto registrado.")).toBeVisible()
    await undoBtn(page).click()
    await expect(row).toHaveCount(0)
    await main.locator("[data-add-task-pill]").click()
    await page.getByRole("textbox", { name: "Adicionar lançamento rápido" }).fill("+ salário 5000")
    const field2 = page.getByRole("textbox", { name: "Adicionar lançamento rápido" })
    await field2.press("Enter")
    const income = main.locator("[data-transaction]").filter({ hasText: "+ R$ 5.000,00" })
    await expect(income.first()).toBeVisible()
    await expect(page.getByText("Entrada registrada.")).toBeVisible()
    // Unreadable text keeps the field and explains.
    await field2.fill("sem valor")
    await field2.press("Enter")
    await expect(page.getByText(/Escreva a descrição e o valor/)).toBeVisible()
  })

  test("Lançamentos: filters, day groups collapse and remember it, ⋯ has only Editar/Excluir, delete with Desfazer, summary and top categories", async ({ page }) => {
    await open(page, "Lançamentos")
    const main = page.getByTestId("transactions-main")
    await expect(main.getByRole("group", { name: "Filtrar por tipo" })).toBeVisible()
    await expect(main.getByRole("button", { name: "Categoria", exact: true })).toBeVisible()
    // Soft scrollbar on the category row.
    expect(await main.getByRole("group", { name: "Filtrar por categoria" }).evaluate((el) => el.className)).toContain("scroll-soft")
    const first = main.locator("[data-day-group]").first()
    const header = first.locator("[data-group-header]")
    await expect(header).toHaveAttribute("aria-expanded", "true")
    await expect(header).toContainText(/^Hoje · \p{L}+, \d{1,2} \p{L}{3}/u)
    await header.click()
    await expect(header).toHaveAttribute("aria-expanded", "false")
    await page.reload()
    await page.getByRole("tab", { name: "Lançamentos", exact: true }).click()
    await expect(main.locator("[data-day-group]").first().locator("[data-group-header]")).toHaveAttribute("aria-expanded", "false")
    await main.locator("[data-day-group]").first().locator("[data-group-header]").click()
    // The card.
    const card = main.locator("[data-transaction]").filter({ hasText: "Mercado do bairro" })
    expect(await computed(card, "border-top-left-radius")).toBe("14px")
    expect(await computed(card.locator("[data-item-title] > span").first().locator("span").first(), "text-overflow")).toBe("ellipsis")
    await card.getByRole("button", { name: /^Ações de/ }).click()
    await expect(page.getByRole("menuitem")).toHaveText([/Editar/, /Excluir/])
    await page.getByRole("menuitem", { name: "Excluir" }).click()
    await expect(page.getByText("Lançamento excluído.")).toBeVisible()
    await expect(card).toHaveCount(0)
    await undoBtn(page).click()
    await expect(card).toHaveCount(1)
    // Type filter and summary.
    await main.getByRole("button", { name: "Entradas", exact: true }).click()
    await expect(page.getByLabel("Resumo da lista")).toContainText(/\d lançamento/)
    await expect(main.locator("[data-transaction]")).toHaveCount(1)
    await main.getByRole("button", { name: "Todos", exact: true }).click()
    await expect(page.getByLabel("Maiores categorias do mês")).toBeVisible()
    await expect(page.getByLabel("Maiores categorias do mês").locator("[data-top-category]").first()).toBeVisible()
    // Search.
    await main.getByRole("searchbox", { name: "Buscar lançamentos" }).fill("zzz")
    await expect(main.getByText("Nenhum lançamento encontrado")).toBeVisible()
  })

  test("Lançamentos: tap the card to edit; the category manager opens from '+ Categoria'", async ({ page }) => {
    await open(page, "Lançamentos")
    const main = page.getByTestId("transactions-main")
    await main.locator("[data-transaction]").filter({ hasText: "Farmácia" }).locator("[data-item-title]").click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("heading", { name: "Editar lançamento" })).toBeVisible()
    await dialog.getByLabel("Descrição").fill("Farmácia popular")
    await dialog.getByRole("button", { name: "Salvar" }).click()
    await expect(main.locator("[data-transaction]").filter({ hasText: "Farmácia popular" })).toHaveCount(1)
    await main.getByRole("button", { name: "Categoria", exact: true }).click()
    await expect(page.getByTestId("picker-categoria")).toBeVisible()
    await expect(page.getByRole("button", { name: "Gerenciar" })).toBeVisible()
    await page.keyboard.press("Escape")
  })

  test("Contas fixas: groups, cards, Pagar + Desfazer, hero and next due dates", async ({ page }) => {
    await open(page, "Contas fixas")
    const main = page.getByTestId("bills-main")
    await expect(main.getByText("Nova conta fixa…")).toBeVisible()
    await expect(main.locator("[data-group]")).toHaveCount(3)
    await expect(main.locator("[data-group=overdue] [data-group-header]")).toHaveAttribute("aria-expanded", "true")
    await expect(main.locator("[data-group=due] [data-group-header]")).toHaveAttribute("aria-expanded", "true")
    await expect(main.locator("[data-group=paid] [data-group-header]")).toHaveAttribute("aria-expanded", "false")
    await expect(main.locator("[data-group=overdue] [data-status-chip]")).toHaveText("Atrasada")
    const bill = main.locator("[data-bill]").filter({ hasText: "Energia elétrica" })
    await expect(bill.locator("[data-day-badge]")).toContainText("dia")
    await expect(bill.locator("[data-item-subtitle]")).toHaveText(/^Moradia · vence em \d+ dias$/)
    await expect(page.getByLabel("Total fixo por mês")).toContainText(/\d+ pagas? · \d+ pendentes? · R\$/)
    await expect(page.getByLabel("Próximos vencimentos").locator("[data-day-badge]")).toHaveCount(3)
    await bill.getByRole("button", { name: "Pagar" }).click()
    await expect(page.getByText("Energia elétrica paga.")).toBeVisible()
    await expect(main.locator("[data-group=paid] [data-group-header]")).toContainText("3")
    await undoBtn(page).click()
    await expect(main.locator("[data-group=paid] [data-group-header]")).toContainText("2")
    // Paid state is per month: next month everything is pending again.
    await page.getByRole("button", { name: "Próximo mês" }).click()
    await expect(main.locator("[data-group=paid]")).toHaveCount(0)
    await expect(main.locator("[data-group=overdue]")).toHaveCount(0)
  })

  test("Metas: groups, goal card, create, edit and Guardar with suggestion chips", async ({ page }) => {
    await open(page, "Metas")
    const main = page.getByTestId("goals-main")
    await expect(main.locator("[data-group=active] [data-group-header]")).toHaveAttribute("aria-expanded", "true")
    await expect(main.locator("[data-group=done] [data-group-header]")).toHaveAttribute("aria-expanded", "false")
    const ring = main.locator("[data-goal]").first().getByRole("progressbar")
    await expect(ring).toHaveAttribute("aria-valuenow", /\d+/)
    await expect(page.getByRole("region", { name: "Guardado nas metas" })).toContainText(/\d+% de R\$/)
    await expect(page.getByLabel("Próximo prazo")).toContainText("faltam R$")
    // 3-column grid on desktop.
    const cols = (await computed(main.locator("[data-group=active] [data-group-rows]"), "grid-template-columns")).split(" ").length
    expect(cols).toBe(3)
    // Achieved goals.
    await main.locator("[data-group=done] [data-group-header]").click()
    const done = main.locator("[data-goal][data-done=true]")
    await expect(done).toContainText("Meta alcançada")
    await expect(done.getByRole("button", { name: "Guardar" })).toBeDisabled()
    // Create.
    await main.getByText("Nova meta…").click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Criar meta" }).click()
    await expect(dialog.getByText("Dê um nome para a meta.")).toBeVisible()
    await dialog.getByLabel("Nome").fill("Moto nova")
    await dialog.getByLabel("Valor da meta").fill("9000")
    await dialog.getByRole("radio", { name: "Carro" }).click()
    await dialog.getByRole("button", { name: "Criar meta" }).click()
    const goal = main.locator("[data-goal]").filter({ hasText: "Moto nova" })
    await expect(goal).toContainText("R$ 0,00 de R$ 9.000,00")
    // Edit.
    await goal.getByRole("button", { name: /^Ações de/ }).click()
    await page.getByRole("menuitem", { name: "Editar" }).click()
    await page.getByRole("dialog").getByLabel("Nome").fill("Moto 0km")
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click()
    await expect(main.locator("[data-goal]").filter({ hasText: "Moto 0km" })).toHaveCount(1)
    // Guardar.
    const edited = main.locator("[data-goal]").filter({ hasText: "Moto 0km" })
    await edited.getByRole("button", { name: "Guardar" }).click()
    const fund = page.getByRole("dialog")
    await expect(fund).toContainText("Faltam R$ 9.000,00 para chegar lá.")
    await fund.locator("[data-suggestion]").filter({ hasText: "R$ 500,00" }).click()
    await expect(fund.getByLabel("Valor", { exact: true })).toHaveValue("500,00")
    await fund.getByRole("button", { name: "Guardar" }).click()
    await expect(edited).toContainText("R$ 500,00 de R$ 9.000,00")
    await expect(undoBtn(page)).toBeVisible()
    await undoBtn(page).click()
    await expect(edited).toContainText("R$ 0,00 de R$ 9.000,00")
  })

  test("dialogs on desktop: centered modal radius 20, close circle, Esc, Enter submits, Saída | Entrada, inline messages", async ({ page }) => {
    await open(page, "Lançamentos")
    const main = page.getByTestId("transactions-main")
    await main.getByRole("searchbox", { name: "Buscar lançamentos" }).fill("zzz")
    await main.getByRole("button", { name: "Novo lançamento" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Novo lançamento" })).toBeVisible()
    expect(parseFloat(await computed(dialog, "border-top-left-radius"))).toBe(20)
    expect(await dialog.getByRole("button", { name: "Close" }).or(dialog.locator("[data-slot=dialog-close]")).first().isVisible()).toBe(true)
    await expect(dialog.getByLabel("Descrição")).toBeFocused()
    const kinds = dialog.getByRole("group", { name: "Tipo do lançamento" }).getByRole("button")
    await expect(kinds).toHaveText(["Saída", "Entrada"])
    await expect(kinds.first()).toHaveAttribute("aria-pressed", "true")
    expect(parseFloat(await computed(dialog.getByLabel("Valor", { exact: true }), "border-top-left-radius"))).toBe(12)
    expect(Math.round((await dialog.getByLabel("Valor", { exact: true }).boundingBox())!.height)).toBeGreaterThanOrEqual(36)
    // Validation: inline, neutral outlined (a border, no red fill).
    await dialog.getByLabel("Descrição").fill("Teste")
    await dialog.getByLabel("Descrição").press("Enter")
    const msg = dialog.getByText("Informe um valor maior que zero.")
    await expect(msg).toBeVisible()
    expect(await computed(msg, "background-color")).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
    expect(await computed(msg, "border-top-width")).toBe("1px")
    await dialog.getByLabel("Valor", { exact: true }).fill("12,30")
    await dialog.getByLabel("Valor", { exact: true }).press("Enter")
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText("Gasto registrado.")).toBeVisible()
    // Esc closes; Cancelar is an outline pill and the primary is Lima.
    await main.getByRole("searchbox", { name: "Buscar lançamentos" }).fill("zzz")
    await main.getByRole("button", { name: "Novo lançamento" }).click()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await page.getByRole("tab", { name: "Contas fixas", exact: true }).click()
    await page.getByText("Nova conta fixa…").click()
    const bill = page.getByRole("dialog")
    await expect(bill).toContainText("Vence todo mês e entra em “A pagar”.")
    await expect(bill.getByRole("radio", { name: "Assinaturas" })).toHaveAttribute("aria-checked", "true")
    expect(parseFloat(await computed(bill.getByRole("button", { name: "Cancelar" }), "border-top-left-radius"))).toBeGreaterThan(100)
    await bill.getByLabel("Nome").fill("Spotify")
    await bill.getByLabel("Valor", { exact: true }).fill("21,90")
    await bill.getByRole("button", { name: "Criar conta fixa" }).click()
    await expect(page.getByTestId("bills-main").locator("[data-bill]").filter({ hasText: "Spotify" })).toHaveCount(1)
  })
})

for (const [label, size] of [["360", { width: 360, height: 780 }], ["390", { width: 390, height: 844 }], ["430", { width: 430, height: 932 }]] as const) {
  for (const theme of ["dark", "light"]) {
    test.describe(`phone ${label} ${theme}`, () => {
      test.use({ viewport: size, hasTouch: true })
      test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!, theme))

      test("every tab fits: no horizontal scroll, short tab labels not clipped, ≥ 90px of room under the content", async ({ page }) => {
        await open(page)
        const tablist = page.getByRole("tablist", { name: "Finanças" })
        await expect(tablist.getByRole("tab")).toHaveText(["Geral", "Lançamentos", "Fixas", "Metas"])
        for (const name of ["Visão geral", "Lançamentos", "Contas fixas", "Metas"] as const) {
          await page.getByRole("tab", { name: { "Visão geral": "Geral", Lançamentos: "Lançamentos", "Contas fixas": "Fixas", Metas: "Metas" }[name], exact: true }).click()
          await page.waitForTimeout(300)
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
          const clipped = await tablist.getByRole("tab").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1 || ((e.firstElementChild as HTMLElement | null)?.scrollWidth ?? 0) > e.clientWidth).length)
          expect(clipped).toBe(0)
          expect(await tablist.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
          // Stat tiles never overflow their card.
          expect(await page.locator("[data-stat-tile]").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length)).toBe(0)
        }
        const pad = await page.getByTestId("financas").evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom))
        expect(pad).toBeGreaterThanOrEqual(90)
      })

      test("header card: title + search/filter circles on Lançamentos, flat month toolbar, Metas has none", async ({ page }) => {
        await open(page, "Visão geral", true)
        const block = page.getByTestId("financas-header-block")
        await expect(block.getByRole("heading", { name: "Finanças" })).toBeVisible()
        expect(await computed(block, "position")).not.toBe("sticky")
        await expect(block.getByRole("button", { name: "Buscar lançamentos" })).toHaveCount(0)
        await expect(page.getByTestId("month-title")).toHaveText(new RegExp(`^${monthName(0)}$`))
        expect(await computed(page.getByTestId("month-toolbar"), "background-color")).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
        await page.getByRole("button", { name: "Próximo mês" }).click()
        await page.getByTestId("month-title").click()
        await expect(page.getByTestId("month-title")).toHaveText(new RegExp(`^${monthName(0)}$`))
        await page.getByRole("tab", { name: "Lançamentos", exact: true }).click()
        await expect(block.getByRole("button", { name: "Buscar lançamentos" })).toBeVisible()
        await expect(block.getByRole("button", { name: "Filtros" })).toBeVisible()
        await expect(page.getByTestId("transaction-tiles").locator("[data-stat-tile]")).toHaveCount(3)
        await page.getByRole("tab", { name: "Metas", exact: true }).click()
        await expect(page.getByTestId("month-title")).toHaveCount(0)
        await expect(block.getByRole("button", { name: "Filtros" })).toHaveCount(0)
      })

      test("contrast: income text, Lima hero and tabs reach 4.5:1", async ({ page }) => {
        await open(page, "Lançamentos", true)
        const income = page.locator("[data-money][data-tone=in]").first()
        const card = income.locator("xpath=ancestor::div[contains(@class,'rounded-[14px]')][1]")
        expect(await contrast(page, await computed(income, "color"), await computed(card, "background-color"))).toBeGreaterThan(4.5)
        await page.getByRole("tab", { name: "Geral", exact: true }).click()
        const hero = page.locator("[data-hero-card]")
        expect(await contrast(page, await computed(hero, "color"), await computed(hero, "background-color"))).toBeGreaterThan(4.5)
        const active = page.getByRole("tab", { name: "Geral", exact: true })
        expect(await contrast(page, await computed(active, "color"), await computed(active, "background-color"))).toBeGreaterThan(4.5)
      })
    })
  }
}

test.describe("phone behaviors", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

  test("Visão geral: hero, three tiles, categories as separate cards (4 + dashed 'Ver todas as categorias'), mobile order", async ({ page }) => {
    await open(page)
    const kpi = page.getByTestId("kpi-row")
    const hero = await kpi.locator("[data-hero-card]").boundingBox()
    expect(Math.round(hero!.width)).toBeGreaterThan(330)
    const tiles = await kpi.locator("[data-stat-tile]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(tiles).size).toBe(1)
    const list = page.getByTestId("spending-list")
    await expect(list.locator("[data-category-card]")).toHaveCount(4)
    await page.getByRole("button", { name: "Ver todas as categorias" }).click()
    expect(await list.locator("[data-category-card]").count()).toBeGreaterThan(4)
    await expect(page.getByTestId("budget-card").locator("[data-category-card]")).toHaveCount(0)
    const order = await page.locator("section[aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))
    const idx = (n: string) => order.indexOf(n)
    expect(idx("Saldo total")).toBeLessThan(idx("Para ficar de olho"))
    expect(idx("Para ficar de olho")).toBeLessThan(idx("Orçamento do mês"))
    expect(idx("Orçamento do mês")).toBeLessThan(idx("Onde estou gastando"))
    expect(idx("Onde estou gastando")).toBeLessThan(idx("Evolução nos últimos 6 meses"))
    expect(idx("Evolução nos últimos 6 meses")).toBeLessThan(idx("Contas e bancos"))
    const chart = await page.locator("section[aria-label='Evolução nos últimos 6 meses'] .recharts-responsive-container").boundingBox()
    expect(Math.round(chart!.height)).toBe(170)
  })

  test("Lançamentos: swipe left deletes with Desfazer; the filter sheet mirrors the desktop filters and shows a count", async ({ page }) => {
    await open(page, "Lançamentos", true)
    const row = page.locator("[data-transaction]").filter({ hasText: "Padaria da esquina" })
    await swipe(row, -160)
    await expect(page.getByText("Lançamento excluído.")).toBeVisible()
    await expect(row).toHaveCount(0)
    expect(await undoBtn(page).boundingBox().then((b) => b!.height)).toBeGreaterThanOrEqual(36)
    await undoBtn(page).click()
    await expect(row).toHaveCount(1)
    // Swiping right does nothing on a transaction.
    await swipe(row, 160)
    await page.waitForTimeout(300)
    await expect(row).toHaveCount(1)
    await expect(page.getByText("Lançamento editado.")).toHaveCount(0)
    // Filters sheet.
    await page.getByRole("button", { name: "Filtros" }).click()
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByRole("heading", { name: "Filtros" })).toBeVisible()
    await sheet.getByRole("button", { name: "Saídas", exact: true }).click()
    await sheet.getByRole("button", { name: "Mercado", exact: true }).click()
    await sheet.getByRole("button", { name: "Ver lançamentos" }).click()
    await expect(page.getByRole("button", { name: "Filtros, 2 ativos" })).toBeVisible()
    await expect(page.getByTestId("financas-header-block").getByTestId("finance-filter")).toContainText("2")
    await expect(page.locator("[data-transaction]").first()).toContainText("Mercado")
    // Search expands inline.
    await page.getByRole("button", { name: "Buscar lançamentos" }).click()
    await page.getByRole("searchbox", { name: "Buscar lançamentos" }).fill("zzz")
    await expect(page.getByText("Nenhum lançamento encontrado")).toBeVisible()
  })

  test("Contas fixas: two-row card, swipe right pays, swipe left deletes, both with Desfazer", async ({ page }) => {
    await open(page, "Contas fixas", true)
    const bill = page.locator("[data-bill]").filter({ hasText: "Plano de saúde" })
    // Row 1: badge + text + ⋯; row 2: amount left, pill right.
    const [badge, amount, pill] = [await bill.locator("[data-day-badge]").boundingBox(), await bill.locator("[data-money]").boundingBox(), await bill.getByRole("button", { name: "Pagar" }).boundingBox()]
    expect(amount!.y).toBeGreaterThan(badge!.y + badge!.height - 4)
    expect(pill!.x).toBeGreaterThan(amount!.x + amount!.width)
    expect(Math.abs(pill!.y - amount!.y)).toBeLessThan(30)
    await expect(bill.locator("[data-status-chip]")).toHaveCount(0)
    await expect(bill.locator("[data-item-title] > span").first()).toContainText("Plano de saúde")
    await swipe(bill, 160)
    await expect(page.getByText("Plano de saúde paga.")).toBeVisible()
    await expect(page.locator("[data-group=paid] [data-group-header]")).toContainText("3")
    await undoBtn(page).click()
    await expect(page.locator("[data-group=paid] [data-group-header]")).toContainText("2")
    await swipe(bill, -160)
    await expect(page.getByText("Conta fixa excluída.")).toBeVisible()
    await expect(bill).toHaveCount(0)
    await undoBtn(page).click()
    await expect(bill).toHaveCount(1)
    // The hero sits above the list on phones.
    const hero = await page.getByLabel("Total fixo por mês").boundingBox()
    const group = await page.locator("[data-group=overdue]").boundingBox()
    expect(hero!.y).toBeLessThan(group!.y)
  })

  test("Metas: stacked cards, hero above, no Próximo prazo card", async ({ page }) => {
    await open(page, "Metas", true)
    const goals = page.locator("[data-group=active] [data-goal]")
    const xs = await goals.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))
    expect(new Set(xs).size).toBe(1)
    await expect(page.getByLabel("Próximo prazo")).toHaveCount(0)
    const hero = await page.getByLabel("Guardado nas metas").first().boundingBox()
    expect((await goals.first().boundingBox())!.y).toBeGreaterThan(hero!.y)
  })

  test("dialogs on phones: bottom sheet with grab handle, primary action stays in view, Esc/Cancelar close", async ({ page }) => {
    await open(page, "Lançamentos", true)
    await page.getByRole("button", { name: "Buscar lançamentos" }).click()
    await page.getByRole("searchbox", { name: "Buscar lançamentos" }).fill("zzz")
    await page.getByRole("button", { name: "Novo lançamento" }).click()
    const sheet = page.locator("[data-vaul-drawer]")
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole("heading", { name: "Novo lançamento" })).toBeVisible()
    await page.waitForTimeout(800)
    expect(await sheet.locator("[class*=\"w-[100px]\"]").count()).toBeGreaterThan(0)
    const save = sheet.getByRole("button", { name: "Salvar" })
    const box = await save.boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    await expect(sheet.getByRole("group", { name: "Tipo do lançamento" })).toBeVisible()
    await sheet.getByRole("button", { name: "Cancelar" }).click()
    await expect(sheet).toHaveCount(0)
    await page.getByRole("tab", { name: "Metas", exact: true }).click()
    await page.getByRole("button", { name: "Guardar" }).first().click()
    const fund = page.locator("[data-vaul-drawer]")
    await expect(fund).toContainText(/Faltam R\$ .* para chegar lá\./)
    await page.keyboard.press("Escape")
    await expect(fund).toHaveCount(0)
  })
})
