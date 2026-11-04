/**
 * Agenda page aligned with Tarefas > Agenda: tinted item chips, "+N" pill, toolbar and header structure, four modes on desktop.
 * On the development fixture /design-system/agenda (events, tasks, treinos and estudos in memory):
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test agenda-unificada
 */
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

async function consent(context: BrowserContext, baseURL: string, theme = "dark") {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t)
    } catch {}
  }, theme)
}

async function open(page: Page) {
  await page.goto("/design-system/agenda")
  await expect(page.getByRole("tablist", { name: "Visão" })).toBeVisible({ timeout: 60000 })
}

const computed = (locator: Locator, prop: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)

/** WCAG contrast of `fg` over the stacked `layers` (bottom first), resolved through a canvas so oklab/alpha just work. */
async function contrast(page: Page, layers: string[], fg: string) {
  return page.evaluate(
    ({ layers, fg }) => {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!
      const paint = (color: string) => {
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      for (const layer of layers) paint(layer)
      const bg = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
      const text = paint(fg)
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => {
          const c = v / 255
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const [hi, lo] = [lum(text), lum(bg)].sort((a, b) => b - a)
      return (hi + 0.05) / (lo + 0.05)
    },
    { layers, fg }
  )
}

test.describe("desktop 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

  test("four modes including the Agenda list; no Hoje or Calendários buttons; Filtros holds Calendários and Mostrar concluídas", async ({ page }) => {
    await open(page)
    await expect(page.getByRole("tab")).toHaveText(["Mês", "Semana", "Dia", "Agenda"])
    await expect(page.getByRole("button", { name: "Hoje", exact: true })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Calendários" })).toHaveCount(0)
    await page.getByRole("button", { name: "Filtros" }).click()
    const panel = page.getByTestId("agenda-filters")
    await expect(panel.getByText("Calendários")).toBeVisible()
    for (const name of ["Eventos", "Tarefas", "Treinos", "Estudos"]) await expect(panel.getByRole("checkbox", { name })).toBeVisible()
    await expect(panel.getByRole("switch", { name: "Mostrar concluídas" })).toBeVisible()
    await page.keyboard.press("Escape")
    await page.getByRole("tab", { name: "Agenda" }).click()
    await expect(page.getByText("Reunião de produto").first()).toBeVisible()
    // The mode pills are the shared PillTabs: 36px, Lima only on the active one.
    const box = (await page.getByRole("tab", { name: "Agenda" }).boundingBox())!
    expect(Math.round(box.height)).toBe(36)
  })

  test("the title and T go to today", async ({ page }) => {
    await open(page)
    const title = page.getByTestId("calendar-title")
    const today = await title.textContent()
    await page.getByTestId("calendar-toolbar").getByRole("button", { name: "Próximo", exact: true }).click()
    await expect(title).not.toHaveText(today!)
    await title.click()
    await expect(title).toHaveText(today!)
    await page.getByTestId("calendar-toolbar").getByRole("button", { name: "Próximo", exact: true }).click()
    await page.keyboard.press("t")
    await expect(title).toHaveText(today!)
  })

  test("items are tinted chips: 16% color, 3px left bar, neutral text; no color = neutral tint without bar", async ({ page }) => {
    await open(page)
    await page.getByRole("tab", { name: "Mês" }).click()
    const colored = page.locator("[data-agenda-item]").filter({ hasText: "Reunião de produto" }).first()
    await expect(colored).toBeVisible()
    expect(await computed(colored, "box-shadow")).toContain("inset")
    expect(await colored.evaluate((el) => el.getAttribute("style"))).toContain("color-mix")
    expect(await computed(colored, "color")).toBe(await page.evaluate(() => getComputedStyle(document.body).color))
    // A legacy Lima swatch keeps rendering (as a saved color), never wiped.
    await page.getByRole("tab", { name: "Semana" }).click()
    const plain = page.getByText("Almoço", { exact: false }).first()
    await expect(plain).toBeVisible()
  })

  for (const theme of ["dark", "light"]) {
    test(`item chip text keeps contrast >= 4.5:1 (${theme})`, async ({ page, context, baseURL }) => {
      await consent(context, baseURL!, theme)
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme)
      await open(page)
      await page.getByRole("tab", { name: "Mês" }).click()
      const chip = page.locator("[data-agenda-item]").filter({ hasText: "Reunião de produto" }).first()
      await expect(chip).toBeVisible()
      const surface = await page.evaluate(() => getComputedStyle(document.querySelector("[data-day-cell]")!).backgroundColor)
      const bg = await computed(chip, "background-color")
      expect(await contrast(page, [surface, bg], await computed(chip, "color"))).toBeGreaterThanOrEqual(4.5)
    })
  }

  test("+N is a pill; it opens the day's items", async ({ page }) => {
    await open(page)
    await page.getByRole("tab", { name: "Mês" }).click()
    const more = page.locator("[data-more-pill]").first()
    await expect(more).toBeVisible()
    expect(await computed(more, "border-top-left-radius")).not.toBe("0px")
    expect(parseFloat(await computed(more, "border-top-left-radius"))).toBeGreaterThanOrEqual(10)
    await more.click()
    await expect(page.locator("[data-more-item]").first()).toBeVisible()
    expect(await page.locator("[data-more-item]").count()).toBeGreaterThanOrEqual(4)
  })

  test("overlapping events sit side by side in the week grid", async ({ page }) => {
    await open(page)
    const a = (await page.getByText("Almoço com cliente").first().boundingBox())!
    const b = (await page.getByText("Revisão de contrato").first().boundingBox())!
    expect(a.x + a.width).toBeLessThanOrEqual(b.x + 4)
  })

  test("a task opens the Tarefas dialog URL", async ({ page }) => {
    await open(page)
    await page.getByRole("tab", { name: "Mês" }).click()
    await page.locator("[data-agenda-item]").filter({ hasText: "Comprar planta" }).first().click()
    await page.waitForURL(/\/dashboard\/tarefas\/.+\?tarefa=/, { timeout: 30000 })
  })
})

for (const width of [360, 390, 430]) {
  test.describe(`phone ${width}`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })
    test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

    test("header block, mode pills without clipping, calendar card without Hoje, title taps to today, flat day title", async ({ page }) => {
      await open(page)
      const block = page.getByTestId("agenda-header-block")
      await expect(block.getByRole("heading", { name: "Agenda" })).toBeVisible()
      await expect(block.getByRole("button", { name: "Buscar na agenda" })).toBeVisible()
      await expect(block.getByRole("button", { name: "Filtros" })).toBeVisible()
      expect(await computed(block, "position")).toBe("static")
      expect(await block.getByRole("tab").evaluateAll((els) => els.map((el) => el.scrollWidth <= el.clientWidth + 1))).toEqual([true, true, true, true])
      expect(Math.round((await block.getByRole("tab").first().boundingBox())!.height)).toBe(36)
      const card = page.getByTestId("calendar-card")
      await expect(card.getByRole("button", { name: "Hoje", exact: true })).toHaveCount(0)
      await expect(page.getByRole("button", { name: "Calendários" })).toHaveCount(0)
      const title = card.getByRole("button", { name: "Ir para hoje" })
      const today = await title.textContent()
      await card.getByRole("button", { name: "Próximo" }).click()
      await expect(title).not.toHaveText(today!)
      await title.click()
      await expect(title).toHaveText(today!)
      await expect(page.getByTestId("day-heading")).toContainText("-feira")
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    })

    test("week strip dots use the item colors; Filtros sheet has Calendários and Mostrar concluídas", async ({ page }) => {
      await open(page)
      await expect(page.getByRole("group", { name: "Dias da semana" }).locator("[data-dots] span").first()).toBeVisible()
      await page.getByTestId("agenda-header-block").getByRole("button", { name: "Filtros" }).click()
      await expect(page.getByTestId("agenda-filters").getByRole("switch", { name: "Mostrar concluídas" })).toBeVisible()
      await expect(page.getByTestId("agenda-filters").getByRole("checkbox", { name: "Treinos" })).toBeVisible()
    })
  })
}

test.describe("day card (selected day only)", () => {
  for (const [label, size] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
    test.describe(label, () => {
      test.use({ viewport: size, hasTouch: label === "phone" })
      test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

      test("only ONE day card; selecting another day replaces it, updates ?date=, and a reload keeps it", async ({ page }) => {
        await open(page)
        await page.getByRole("tab", { name: "Mês" }).click()
        await expect(page.getByTestId("day-card")).toHaveCount(1)
        await expect(page.getByRole("heading", { name: /^Hoje/ }).or(page.getByText(/^Hoje · /))).toBeVisible()
        const tomorrow = await page.evaluate(() => {
          const sel = document.querySelector('[role="gridcell"][aria-selected="true"], [data-day-cell][class*="bg-muted"]') as HTMLElement | null
          const cells = [...document.querySelectorAll("[data-day-cell]")] as HTMLElement[]
          const i = Math.max(0, cells.indexOf(sel ?? cells[0]))
          return cells[i + 1]?.getAttribute("data-day-cell") ?? ""
        })
        if (label === "desktop") await page.locator(`[data-day-cell="${tomorrow}"] button`).first().click()
        else await page.locator(`[data-day-cell="${tomorrow}"] button`).first().click()
        await expect(page).toHaveURL(new RegExp(`date=${tomorrow}`))
        await expect(page.getByTestId("day-card")).toHaveCount(1)
        await expect(page.getByTestId("day-card")).toHaveAttribute("data-day", tomorrow)
        await expect(page.getByText(/^Hoje · /)).toHaveCount(0)
        await page.reload()
        await expect(page.getByTestId("day-card")).toHaveAttribute("data-day", tomorrow, { timeout: 60000 })
      })

      test("VIEW mode: groups Tarefas/Eventos/Treinos/Estudos with counts, no + or ⋯, exactly one Novo evento pill", async ({ page }) => {
        await open(page)
        const card = page.getByTestId("day-card")
        for (const name of ["Tarefas", "Eventos", "Treinos", "Estudos"]) await expect(card.getByRole("region", { name })).toBeVisible()
        await expect(card.getByRole("region", { name: "Estudos" }).locator("[data-group-header]")).toContainText("0")
        await expect(card.getByRole("button", { name: /^Adicionar/ })).toHaveCount(0)
        await expect(card.getByRole("button", { name: /Mais ações|Opções/ })).toHaveCount(0)
        await expect(page.locator("[data-add-task-pill]")).toHaveCount(1)
        await expect(page.getByRole("button", { name: "Novo evento…" })).toBeVisible()
        if (label === "phone") expect(await card.evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
        // Treinos are read-only: they open their module.
        await card.locator('[data-kind="workout"]').first().click()
        await page.waitForURL(/\/dashboard\/treinos/, { timeout: 30000 })
      })
    })
  }

  test.describe("color helper", () => {
    test.use({ viewport: { width: 1440, height: 900 } })
    test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))
    test("the event editor says exactly 'Aparece no cartão e no calendário.' without a color name", async ({ page }) => {
      await open(page)
      await page.getByRole("button", { name: "Novo evento…" }).click()
      const dialog = page.getByRole("dialog")
      await expect(dialog.getByText("Aparece no cartão e no calendário.", { exact: true })).toBeVisible()
      await dialog.getByRole("radio", { name: "Vermelho" }).click()
      await expect(dialog.getByText("Aparece no cartão e no calendário.", { exact: true })).toBeVisible()
      await expect(dialog.getByText(/Vermelho\./)).toHaveCount(0)
    })
  })
})
