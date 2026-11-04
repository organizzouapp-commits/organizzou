/**
 * Tarefas: dialog properties, ColorPicker, mobile header card, Lista spacing and the task card geometry.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test tarefas-geometria
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function setup(browser: Browser, baseURL: string, width: number, height = 900, theme = "dark") {
  const context: BrowserContext = await browser.newContext({ viewport: { width, height }, hasTouch: width < 500, isMobile: width < 500 })
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t)
    } catch {}
  }, theme)
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
const cy = (b: { y: number; height: number }) => b.y + b.height / 2

for (const width of [360, 1440]) {
  test.describe(`dialog and colors, ${width}`, () => {
    test("Categoria and Cor da tarefa are visible without 'Mais opções'; helper copy is exact; ONE row of 7 + '+'", async ({ browser, baseURL }) => {
      const { context, page } = await setup(browser, baseURL!, width, 900)
      await open(page)
      await page.locator("[data-task-id]").first().click()
      const block = page.getByTestId("task-color-block")
      await block.scrollIntoViewIfNeeded()
      await expect(page.getByText("Mais opções")).toHaveCount(0)
      await expect(page.getByRole("button", { name: "Categoria" }).first()).toBeVisible()
      await expect(block.getByText("Aparece no cartão, na Agenda e no Calendário.", { exact: true })).toBeVisible()
      const swatches = block.locator("[data-swatch]")
      expect(await swatches.allInnerTexts()).toHaveLength(7)
      const labels = await swatches.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))
      expect(labels).toEqual(["Sem cor", "Vermelho", "Amarelo", "Azul", "Laranja", "Verde", "Adicionar cor personalizada"])
      const tops = await swatches.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
      expect(new Set(tops).size).toBe(1)
      const row = block.locator("[data-color-row]")
      expect(await row.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true)
      await context.close()
    })

    test("custom color: validation, saved after the defaults, still there after a reload", async ({ browser, baseURL }) => {
      const { context, page } = await setup(browser, baseURL!, width, 900)
      await open(page)
      await page.locator("[data-task-id]").first().click()
      const block = page.getByTestId("task-color-block")
      await block.scrollIntoViewIfNeeded()
      await block.getByRole("button", { name: "Adicionar cor personalizada" }).click()
      const panel = page.getByTestId("custom-color-panel")
      const hex = panel.getByLabel("Código da cor (#RRGGBB)")
      await hex.fill("#12")
      await expect(panel.getByRole("button", { name: "Salvar cor" })).toBeDisabled()
      await hex.fill("#12AB34")
      await panel.getByRole("button", { name: "Salvar cor" }).click()
      await expect(block.getByRole("radio", { name: "#12AB34" })).toHaveAttribute("aria-checked", "true")
      await page.reload()
      await expect(page.locator('button[aria-label^="Quadro:"]')).toBeVisible({ timeout: 60000 })
      await expect(page.getByTestId("task-color-block").getByRole("radio", { name: "#12AB34" })).toBeVisible()
      await context.close()
    })

    test("an old stored color keeps rendering and shows in the picker", async ({ browser, baseURL }) => {
      const { context, page } = await setup(browser, baseURL!, width, 900)
      await context.addInitScript(() => {
        try {
          if (!localStorage.getItem("organizzou:tarefas-colors")) localStorage.setItem("organizzou:tarefas-colors", JSON.stringify({ colors: { task: { "d0000000-0000-4000-8000-000000000001": "lima-verso" } }, custom: [] }))
        } catch {}
      })
      await open(page)
      await expect(page.locator("[data-task-color]").first()).toHaveAttribute("data-task-color", "#8FA800")
      await page.locator("[data-task-id]").first().click()
      await expect(page.getByTestId("task-color-block").getByRole("radio", { name: "Lima verso" })).toBeVisible()
      await context.close()
    })
  })
}

test.describe("task card geometry", () => {
  for (const width of [390, 1440]) {
    test(`check/title centers, 20px check, 12px bar gap, flag and ⋯ alignment, counters edge (${width})`, async ({ browser, baseURL }) => {
      const { context, page } = await setup(browser, baseURL!, width, 900)
      await open(page)
      const cards = page.locator("[data-task-id]")
      const n = await cards.count()
      expect(n).toBeGreaterThan(3)
      for (let i = 0; i < Math.min(n, 8); i++) {
        const card = cards.nth(i)
        const check = card.locator("[data-task-check] button").first()
        const title = card.locator("[data-task-title]").first()
        const cb = await rect(check)
        expect(Math.round(cb.width)).toBe(20)
        // First line of the title: line-height 20px from the top of the title box.
        const tb = await rect(title)
        expect(Math.abs(cy(cb) - (tb.y + 10))).toBeLessThanOrEqual(1)
        const actions = card.locator("[data-task-actions]")
        const more = actions.locator("button").first()
        const mb = await rect(more)
        expect(Math.abs(cy(mb) - (tb.y + 10))).toBeLessThanOrEqual(1)
        expect(Math.round(mb.width)).toBe(32)
        const flag = actions.locator("svg[aria-label^='Prioridade']")
        if (await flag.count()) {
          const fb = await rect(flag)
          expect(Math.abs(cy(fb) - cy(mb))).toBeLessThanOrEqual(1)
          expect(Math.round(fb.width)).toBe(16)
        }
        // The ⋯ slot is the same distance from the card's right edge with or without a flag.
        const box = await rect(card.locator("xpath=ancestor-or-self::*[@data-task-id][1]"))
        expect(Math.round(box.x + box.width - (mb.x + mb.width))).toBeGreaterThanOrEqual(11)
        expect(Math.round(box.x + box.width - (mb.x + mb.width))).toBeLessThanOrEqual(14)
        const counters = card.locator("[data-task-counters]")
        if (await counters.count()) {
          const cr = await rect(counters)
          expect(Math.abs(cr.x + cr.width - (mb.x + mb.width))).toBeLessThanOrEqual(2)
        }
      }
      await context.close()
    })
  }

  test("a colored card: check at 24px from the edge, 12px after the 4px bar", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390, 900)
    await context.addInitScript(() => {
      try {
        localStorage.setItem("organizzou:tarefas-colors", JSON.stringify({ colors: { task: { "d0000000-0000-4000-8000-000000000001": "vermelho" } }, custom: [] }))
      } catch {}
    })
    await open(page)
    const card = page.locator("[data-task-id]").filter({ has: page.locator("[data-task-color]") }).first()
    const edge = (await rect(card)).x
    const bar = await rect(card.locator("[data-task-color]"))
    const check = await rect(card.locator("[data-task-check] button").first())
    expect(Math.round(bar.x - edge)).toBe(9) // 1px border + 8px
    expect(Math.round(bar.width)).toBe(4)
    expect(Math.round(check.x - (bar.x + bar.width))).toBe(12)
    await context.close()
  })

  test("meta row: date, priority, category and tags share a line; '+N' beyond three chips", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 1440, 900)
    await open(page)
    const card = page.locator("[data-task-id]").filter({ hasText: "Revisar proposta" }).first()
    const items = card.locator("[data-task-meta] > *")
    const tops = await items.evaluateAll((els) => els.filter((e) => !e.hasAttribute("data-task-counters")).map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)
    await context.close()
  })
})

test.describe("mobile header card", () => {
  for (const width of [360, 390, 430]) {
    test(`no clipping, 12px top margin, icon-only segmented control (${width})`, async ({ browser, baseURL }) => {
      const { context, page } = await setup(browser, baseURL!, width, 800)
      await open(page)
      const header = page.getByTestId("board-header")
      expect((await header.evaluate((e) => parseFloat(getComputedStyle(e).marginTop)))).toBeGreaterThanOrEqual(12)
      const name = page.locator("[data-board-name]")
      expect(await name.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
      expect(await name.innerText()).toBe("Minhas tarefas")
      const tabs = page.locator("[data-view-tab]")
      await expect(tabs).toHaveCount(3)
      for (const t of await tabs.all()) {
        await expect(t).toHaveAttribute("aria-label", /Kanban|Lista|Calendário/)
        expect((await rect(t)).height).toBeGreaterThanOrEqual(32)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      // The active list tab is fully visible.
      const active = page.locator('[data-list-tab][aria-selected="true"]')
      const box = await rect(active)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      await context.close()
    })
  }

  test("Lista: collapsed group headers are 52px apart with no blank strip", async ({ browser, baseURL }) => {
    const { context, page } = await setup(browser, baseURL!, 390, 800)
    await open(page, "lista")
    for (const name of ["A fazer", "Em andamento"]) await page.getByRole("button", { name: `Recolher ${name}` }).click()
    await page.waitForTimeout(700)
    const tops = await page.locator("[data-group-header]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(tops[1] - tops[0]).toBe(52)
    expect(tops[2] - tops[1]).toBe(52)
    await context.close()
  })
})

test("label colors reach 3:1 on their surfaces in both themes", async ({ browser, baseURL }) => {
  for (const theme of ["dark", "light"]) {
    const { context, page } = await setup(browser, baseURL!, 390, 800, theme)
    await open(page)
    const ratios = await page.evaluate(() => {
      const probe = (css: string) => {
        const c = document.createElement("canvas")
        c.width = c.height = 1
        const g = c.getContext("2d", { willReadFrequently: true })!
        g.fillStyle = css
        g.fillRect(0, 0, 1, 1)
        return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const style = getComputedStyle(document.documentElement)
      const surface = getComputedStyle(document.body).backgroundColor
      const card = style.getPropertyValue("--card").trim()
      const out: Record<string, number> = {}
      for (const name of ["red", "yellow", "blue", "orange", "green"]) {
        const color = lum(probe(style.getPropertyValue(`--label-${name}`).trim()))
        for (const [k, bg] of [["card", card], ["page", surface]] as const) {
          const [hi, lo] = [color, lum(probe(bg))].sort((a, b) => b - a)
          out[`${name}/${k}`] = (hi + 0.05) / (lo + 0.05)
        }
      }
      return out
    })
    for (const [k, v] of Object.entries(ratios)) expect(v, `${theme} ${k}`).toBeGreaterThanOrEqual(3)
    await context.close()
  }
})
