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

/** The "Desfazer" of the newest toast (older ones may still be leaving the screen). */
const undoBtn = (page: Page) => page.locator("[data-sonner-toast]").first().getByRole("button", { name: "Desfazer" })

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
        // The group headers carry no "+" or ⋯ (the rows have their own ⋯).
        await expect(card.locator("[data-group-header] button")).toHaveCount(0)
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

test.describe("Agenda page: separate bordered cards, open / conclude / delete, Agenda mode", () => {
  for (const [label, size] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]] as const) {
    test.describe(label, () => {
      test.use({ viewport: size, hasTouch: label === "phone" })
      test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

      test("items are the SAME TaskCard, each a separate bordered card 8px apart (no hairline rows, no wrapping container)", async ({ page }) => {
        await open(page)
        const card = page.getByTestId("day-card")
        expect(await card.locator("[data-group]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual(["Tarefas", "Eventos", "Treinos", "Estudos"])
        await expect(page.locator("[data-agenda-row]")).toHaveCount(0)
        const events = card.getByRole("region", { name: "Eventos" }).locator("[data-task-id]")
        const first = events.first()
        expect(await computed(first.locator("xpath=.."), "border-top-width").catch(() => "1px")).toBeTruthy()
        const body = card.getByRole("region", { name: "Eventos" }).locator("[data-density=card]").first()
        expect(await computed(body, "border-top-width")).toBe("1px")
        expect(await computed(body, "background-color")).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
        expect(parseFloat(await computed(body, "border-top-left-radius"))).toBe(14)
        const a = (await events.nth(0).boundingBox())!
        const b = (await events.nth(1).boundingBox())!
        expect(Math.round(b.y - (a.y + a.height))).toBe(8)
        const rows = card.getByRole("region", { name: "Eventos" }).locator("[data-group-rows]")
        expect(await computed(rows, "border-top-width")).toBe("0px")
        expect(await computed(rows, "background-color")).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
        // The shared card's own parts.
        await expect(first.locator("[data-task-open]")).toBeVisible()
        await expect(first.locator("[data-task-check]")).toBeVisible()
      })

      test("card anatomy: one-line title, date row with type icon and place, label chip for treino, color bar only when colored", async ({ page }) => {
        await open(page)
        const card = page.getByTestId("day-card")
        const byTitle = (t: string) => card.locator("[data-task-id]").filter({ hasText: t }).first()
        const title = byTitle("Reunião de produto").locator("[data-task-title]")
        expect(await computed(title, "text-wrap-mode")).toBe("nowrap")
        expect(await computed(title, "text-overflow")).toBe("ellipsis")
        await expect(byTitle("Reunião de produto").locator("[data-type-icon=event]")).toBeVisible()
        await expect(byTitle("Reunião de produto").locator("[data-agenda-when]")).toContainText("09:00 – 10:30")
        await expect(byTitle("Dentista").locator("[data-agenda-when]")).toContainText("Clínica Sorriso")
        await expect(byTitle("Treino A").locator("[data-type-icon=workout]")).toBeVisible()
        await expect(byTitle("Treino A").locator("[data-agenda-when]")).toContainText("Dia todo")
        await expect(byTitle("Treino A").getByRole("group", { name: "Etiquetas" })).toContainText("Treino")
        await expect(byTitle("Comprar planta para a sala").locator("[data-type-icon]")).toHaveCount(0)
        await expect(byTitle("Reunião de produto").locator("[data-task-color]")).toHaveCount(1)
        await expect(byTitle("Almoço com cliente").locator("[data-task-color]")).toHaveCount(0)
        await expect(page.locator("[data-time-col]")).toHaveCount(0)
      })

      test("the checkbox concludes every type in place with Desfazer; event and treino state survives a reload", async ({ page }) => {
        await open(page)
        const card = page.getByTestId("day-card")
        for (const title of ["Comprar planta para a sala", "Aula de inglês", "Treino A"]) {
          await card.locator("[data-task-id]").filter({ hasText: title }).first().getByRole("checkbox").click()
          await expect(page.getByText(/Tarefa concluída\.|Concluído\./).last()).toBeVisible()
          await expect(card.locator("[data-task-id]").filter({ hasText: title })).toHaveCount(0)
          await undoBtn(page).click()
          await expect(card.locator("[data-task-id]").filter({ hasText: title })).toHaveCount(1)
        }
        await card.locator("[data-task-id]").filter({ hasText: "Aula de inglês" }).first().getByRole("checkbox").click()
        await expect(card.locator("[data-task-id]").filter({ hasText: "Aula de inglês" })).toHaveCount(0)
        await page.reload()
        await expect(page.getByTestId("day-card")).toBeVisible({ timeout: 60000 })
        await expect(page.getByTestId("day-card").locator("[data-task-id]").filter({ hasText: "Aula de inglês" })).toHaveCount(0)
        // Estudos: shown on their day in the Agenda list.
        await page.getByRole("tab", { name: "Agenda", exact: true }).click()
        await page.getByTestId("agenda-toggle-all").click()
        const exam = page.locator("[data-agenda-day] [data-task-id]").filter({ hasText: "Prova de cálculo" }).first()
        await exam.getByRole("checkbox").click()
        await expect(page.locator("[data-agenda-day] [data-task-id]").filter({ hasText: "Prova de cálculo" })).toHaveCount(0)
        await undoBtn(page).click()
        await expect(page.locator("[data-agenda-day] [data-task-id]").filter({ hasText: "Prova de cálculo" })).toHaveCount(1)
      })

      test("⋯ has exactly Abrir and Excluir, for every type", async ({ page }) => {
        await open(page)
        const card = page.getByTestId("day-card")
        for (const title of ["Ligar para o contador", "Reunião de produto", "Treino A"]) {
          await card.locator("[data-task-id]").filter({ hasText: title }).first().getByRole("button", { name: /^Mais ações/ }).click()
          await expect(page.getByRole("menuitem")).toHaveText([/Abrir/, /Excluir/])
          await page.keyboard.press("Escape")
        }
      })

      test("Excluir: a task and a plain event go with a visible Desfazer (44px hit area, above the bottom nav) that restores them", async ({ page }) => {
        await open(page)
        const card = page.getByTestId("day-card")
        const item = (t: string) => card.locator("[data-task-id]").filter({ hasText: t })
        await item("Dentista").first().getByRole("button", { name: /^Mais ações/ }).click()
        await page.getByRole("menuitem", { name: "Excluir" }).click()
        await expect(item("Dentista")).toHaveCount(0)
        const undo = undoBtn(page)
        await expect(undo).toBeVisible()
        await page.waitForTimeout(700)
        expect(Math.round((await undo.boundingBox())!.height)).toBeGreaterThanOrEqual(36)
        expect(await undo.evaluate((el) => getComputedStyle(el, "::after").top)).toBe("-4px")
        if (label === "phone") expect((await undo.boundingBox())!.y + (await undo.boundingBox())!.height).toBeLessThanOrEqual(844 - 80)
        await undo.click()
        await expect(item("Dentista")).toHaveCount(1)
        await item("Ligar para o contador").first().getByRole("button", { name: /^Mais ações/ }).click()
        await page.getByRole("menuitem", { name: "Excluir" }).click()
        await expect(item("Ligar para o contador")).toHaveCount(0)
        await expect(page.getByText("Tarefa excluída.")).toBeVisible()
        await undoBtn(page).click()
        await expect(item("Ligar para o contador")).toHaveCount(1)
      })

      test("deleting a recurring treino asks Só esta ocorrência / Toda a série, and Desfazer restores either", async ({ page }) => {
        await open(page)
        const card = page.getByTestId("day-card")
        const treino = () => card.locator("[data-task-id]").filter({ hasText: "Treino A" })
        await treino().first().getByRole("button", { name: /^Mais ações/ }).click()
        await page.getByRole("menuitem", { name: "Excluir" }).click()
        const ask = page.getByRole("dialog")
        await expect(ask.getByRole("button", { name: "Só esta ocorrência" })).toBeVisible()
        await expect(ask.getByRole("button", { name: "Toda a série" })).toBeVisible()
        await ask.getByRole("button", { name: "Só esta ocorrência" }).click()
        await expect(treino()).toHaveCount(0)
        await undoBtn(page).click()
        await expect(treino()).toHaveCount(1)
        await treino().first().getByRole("button", { name: /^Mais ações/ }).click()
        await page.getByRole("menuitem", { name: "Excluir" }).click()
        await page.getByRole("dialog").getByRole("button", { name: "Toda a série" }).click()
        await expect(treino()).toHaveCount(0)
        await undoBtn(page).click()
        await expect(treino()).toHaveCount(1)
      })

      if (label === "phone") {
        test("swipe right concludes and swipe left deletes, both with Desfazer", async ({ page }) => {
          await open(page)
          const card = page.getByTestId("day-card")
          const swipe = async (title: string, dx: number) => {
            const target = card.locator("[data-task-id]").filter({ hasText: title }).first().locator("[data-task-open]")
            await target.evaluate(async (el, delta) => {
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
          await swipe("Comprar planta para a sala", 140)
          await expect(page.getByText("Tarefa concluída.")).toBeVisible()
          await undoBtn(page).click()
          await expect(card.locator("[data-task-id]").filter({ hasText: "Comprar planta para a sala" })).toHaveCount(1)
          await swipe("Aula de inglês", -90)
          const del = card.locator("[data-task-id]").filter({ hasText: "Aula de inglês" }).first().locator("xpath=ancestor::div[@data-agenda-card]").locator("[data-swipe-delete]")
          await del.click()
          await expect(card.locator("[data-task-id]").filter({ hasText: "Aula de inglês" })).toHaveCount(0)
          await undoBtn(page).click()
          await expect(card.locator("[data-task-id]").filter({ hasText: "Aula de inglês" })).toHaveCount(1)
        })
      }

      test("Agenda mode: Próximos 30 dias, collapsible days (today open), bordered cards in order, Recolher/Expandir tudo, ±30 days", async ({ page }) => {
        await open(page)
        await page.getByRole("tab", { name: "Agenda", exact: true }).click()
        await expect(page.getByTestId("calendar-title")).toHaveText("Próximos 30 dias")
        const days = page.locator("[data-agenda-day]")
        expect(await days.count()).toBeGreaterThan(2)
        expect(await days.locator("[data-group-header] span").evaluateAll((els) => els.map((e) => e.textContent))).not.toContain("0")
        const today = days.first()
        await expect(today.locator("[data-group-header]")).toHaveAttribute("aria-expanded", "true")
        await expect(today.locator("[data-group-header]")).toContainText("Hoje ·")
        await expect(days.nth(1).locator("[data-group-header]")).toHaveAttribute("aria-expanded", "false")
        await expect(page.locator("[data-time-col]")).toHaveCount(0)
        expect(await computed(today.locator("[data-density=card]").first(), "border-top-width")).toBe("1px")
        // All-day first, then chronological.
        const whens = await today.locator("[data-agenda-when]").evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()))
        const allDay = whens.filter((t) => t.startsWith("Dia todo")).length
        expect(whens.slice(0, allDay).every((t) => t.startsWith("Dia todo"))).toBe(true)
        const times = whens.slice(allDay).map((t) => t.slice(0, 5))
        expect([...times].sort()).toEqual(times)
        const second = days.nth(1).locator("[data-group-header]")
        await second.focus()
        await page.keyboard.press("Enter")
        await expect(second).toHaveAttribute("aria-expanded", "true")
        const all = page.getByTestId("agenda-toggle-all")
        await expect(all).toHaveText("Expandir tudo")
        await all.click()
        await expect(all).toHaveText("Recolher tudo")
        await page.reload()
        await page.getByRole("tab", { name: "Agenda", exact: true }).click()
        await expect(page.locator("[data-agenda-day]").nth(2).locator("[data-group-header]")).toHaveAttribute("aria-expanded", "true", { timeout: 60000 })
        await page.getByTestId("agenda-toggle-all").click()
        await expect(page.locator("[data-agenda-day]").first().locator("[data-group-header]")).toHaveAttribute("aria-expanded", "false")
        await page.getByRole("button", { name: "Próximo", exact: true }).click()
        const title = page.getByTestId("calendar-title")
        await expect(title).toHaveText(/^\d{1,2} \p{L}{3} – \d{1,2} \p{L}{3}$/u)
        await title.click()
        await expect(title).toHaveText("Próximos 30 dias")
      })
    })
  }

  test.describe("Tarefas > Agenda view", () => {
    test.use({ viewport: { width: 1440, height: 900 } })
    test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))
    test("says Próximos 30 dias and renders the same TaskCard", async ({ page }) => {
      await page.goto("/design-system/tarefas?view=agenda")
      await expect(page.getByTestId("calendar-title")).toBeVisible({ timeout: 60000 })
      await page.getByRole("tab", { name: "Agenda", exact: true }).last().click()
      await expect(page.getByTestId("calendar-title")).toHaveText("Próximos 30 dias")
      await expect(page.getByTestId("agenda-list").locator("[data-task-id]").first()).toBeVisible()
    })
  })
})
