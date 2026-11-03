/**
 * "Hoje": the module cards, the shared timeline structure on phone and desktop, the Pro-only assistant entry and the capped
 * notifications panel. The "Hoje" tests run on the development fixture page /design-system/hoje (real components, rich data, no
 * database); server actions are answered by a stub because nobody is signed in there.
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test hoje-modules
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const SIDEBAR_COOKIE = "sidebar_state_00000000000040008000000000000001"

async function consent(context: BrowserContext, baseURL: string, extra: { name: string; value: string }[] = []) {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }, ...extra.map((c) => ({ ...c, url: baseURL }))])
}

/** Server actions answer { ok: true } (the fixture page has no signed-in person). */
async function stubActions(page: Page) {
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      return route.fulfill({ status: 200, contentType: "text/x-component", body: '0:{"a":"$@1","f":"","b":"dev"}\n1:{"ok":true,"sessionId":"s1","transactionId":"t1","stored":"cookie"}\n' })
    }
    return route.continue()
  })
}

async function openFixture(page: Page) {
  await stubActions(page)
  await page.goto("/design-system/hoje")
  await expect(page.getByRole("heading", { name: "Seu dia" })).toBeVisible({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
}

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
const desktop = { viewport: { width: 1280, height: 900 } }

const cardHeader = (page: Page, id: string) => page.locator(`[data-module-card="${id}"] > button`)

// ---------------------------------------------------------------------------------------------------------------------

test.describe("structure", () => {
  test("phone and desktop render the same blocks in the same order", async ({ browser, baseURL }) => {
    const orders: string[][] = []
    for (const ctxOptions of [phone, desktop]) {
      const context = await browser.newContext(ctxOptions)
      await consent(context, baseURL!)
      const page = await context.newPage()
      await openFixture(page)
      orders.push(
        await page.evaluate(() => {
          const groups = [...document.querySelectorAll("[data-group]")].map((el) => `group:${el.getAttribute("data-group")}`)
          // The cards and labels in VISUAL order: CSS `order` first, then the DOM position.
          const stack = [...document.querySelectorAll('[data-testid="module-cards"] > *')]
            .map((el, index) => ({ el, index, order: Number(getComputedStyle(el).order) }))
            .filter(({ el }) => getComputedStyle(el).display !== "none")
            .sort((a, b) => a.order - b.order || a.index - b.index)
            .map(({ el }) => (el.tagName === "P" ? `label:${el.textContent}` : `card:${el.querySelector("[data-module-card]")!.getAttribute("data-module-card")}`))
          return ["main:seu-dia", ...groups, ...stack]
        })
      )
      // Single column on the phone: every card spans the width of the page content (16 px gutters).
      if (ctxOptions === phone) {
        const boxes = await page.locator("[data-module-card]").evaluateAll((els) => els.map((el) => ({ left: Math.round(el.getBoundingClientRect().left), width: Math.round(el.getBoundingClientRect().width) })))
        for (const box of boxes) expect(box).toEqual({ left: 16, width: 358 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      }
      await context.close()
    }
    expect(orders[0]).toEqual(orders[1])
    expect(orders[0]).toContain("label:Precisa de você")
    expect(orders[0]).toContain("label:No ritmo")
    // Cards that need attention come first, the rest after "No ritmo".
    const stack = orders[0].filter((x) => x.startsWith("card:") || x.startsWith("label:"))
    expect(stack.indexOf("label:Precisa de você")).toBe(0)
    expect(stack.indexOf("label:No ritmo")).toBe(stack.length - 2)
    expect(stack.slice(-1)).toEqual(["card:dieta"])
  })

  test("the floating assistant button does not exist", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/dashboard")
    await expect(page.getByRole("link", { name: "Hoje" }).first()).toBeVisible({ timeout: 60000 })
    await expect(page.getByRole("button", { name: /Abrir o assistente|Falar com o assistente/ })).toHaveCount(0)
  })
})

test.describe("module cards (phone)", () => {
  test.use(phone)

  test("accordion: one card open at a time, aria-expanded and inert follow", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    const study = cardHeader(page, "estudos")
    const finance = cardHeader(page, "financas")
    await expect(study).toHaveAttribute("aria-expanded", "false")
    await expect(page.locator('[data-module-card="estudos"] [inert]')).toHaveCount(1)
    await study.click()
    await expect(study).toHaveAttribute("aria-expanded", "true")
    await expect(page.locator('[data-module-card="estudos"] [inert]')).toHaveCount(0)
    await finance.click()
    await expect(finance).toHaveAttribute("aria-expanded", "true")
    await expect(study).toHaveAttribute("aria-expanded", "false")
    await expect(page.locator('[data-module-card="estudos"] [inert]')).toHaveCount(1)
    await finance.click()
    await expect(finance).toHaveAttribute("aria-expanded", "false")
    await expect(page.locator("[data-module-card] > button[aria-expanded=true]")).toHaveCount(0)
  })

  for (const width of [360, 390]) {
    test(`the expanded panel spans the card inner width (no indent) and nothing is clipped, at ${width}px`, async ({ page, context, baseURL }) => {
      await page.setViewportSize({ width, height: 844 })
      await consent(context, baseURL!)
      await openFixture(page)
      for (const id of ["estudos", "financas", "dieta", "treino", "notas"]) {
        await cardHeader(page, id).click()
        const body = page.locator(`[data-module-card="${id}"] > div`)
        // Wait for the unfold to finish: the grid wrapper's height is then the content's height.
        await expect
          .poll(async () => body.evaluate((el) => Math.abs(el.getBoundingClientRect().height - (el.firstElementChild as HTMLElement).scrollHeight)), { timeout: 5000 })
          .toBeLessThan(1.5)
        const m = await page.locator(`[data-module-card="${id}"]`).evaluate((card) => {
          const c = card.getBoundingClientRect()
          const content = (card.querySelector(":scope > div > div > div") as HTMLElement).getBoundingClientRect()
          const children = [...(card.querySelectorAll(":scope > div > div > div > *:not([aria-hidden])") as NodeListOf<HTMLElement>)].map((el) => el.getBoundingClientRect().right - c.left)
          const style = getComputedStyle(card.querySelector(":scope > div > div > div") as HTMLElement)
          return { padLeft: parseFloat(style.paddingLeft), padRight: parseFloat(style.paddingRight), contentLeft: content.left - c.left, contentRight: c.right - content.right, widest: Math.max(...children), cardWidth: c.width }
        })
        // The content box fills the card (inside its 1 px border) with 16 px padding on each side: aligned to the card's own edges.
        expect(Math.round(m.contentLeft)).toBe(1)
        expect(Math.round(m.contentRight)).toBe(1)
        expect(m.padLeft).toBe(16)
        expect(m.padRight).toBe(16)
        expect(m.widest).toBeLessThanOrEqual(m.cardWidth - 17)
        await cardHeader(page, id).click()
      }
      // The study button and the module link are full width.
      await cardHeader(page, "estudos").click()
      const button = page.getByRole("link", { name: /cartões para revisar/ })
      await expect(button).toBeVisible()
      const card = (await page.locator('[data-module-card="estudos"]').boundingBox())!
      const bb = (await button.boundingBox())!
      expect(Math.round(bb.width)).toBe(Math.round(card.width) - 34)
      expect(bb.height).toBeGreaterThanOrEqual(44)
      await expect(page.getByRole("link", { name: /Abrir Estudos/ })).toBeVisible()
    })
  }

  test("mood: one tap logs it, shows the label and the edit action; the buttons are 44 px", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    const radios = page.getByRole("radiogroup", { name: "Humor de hoje" }).getByRole("radio")
    await expect(radios).toHaveCount(5)
    for (const box of await radios.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44)
    await page.getByRole("radio", { name: "Bem", exact: true }).click()
    await expect(page.getByRole("radio", { name: "Bem", exact: true })).toHaveAttribute("aria-checked", "true")
    await expect(page.getByTestId("mood-label")).toHaveText("Hoje: bem")
    await expect(page.locator('[data-module-card="humor"]').getByRole("button", { name: "Editar" })).toBeVisible()
  })

  test("swipe left on a task reveals Adiar 1 h and Amanhã (76 px panels)", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    const row = page.locator(".touch-pan-y").filter({ hasText: "Revisar proposta do cliente" }).first()
    await row.scrollIntoViewIfNeeded()
    const box = (await row.boundingBox())!
    // A real swipe takes time: React re-renders between the events, so they are sent one at a time.
    const fire = (type: string, dx: number) =>
      row.evaluate((el, a) => el.dispatchEvent(new PointerEvent(a.type, { bubbles: true, pointerType: "touch", clientX: a.x, clientY: a.y, isPrimary: true })), { type, x: box.x + box.width - 20 - dx, y: box.y + box.height / 2 })
    await fire("pointerdown", 0)
    for (const dx of [20, 60, 120, 180]) {
      await fire("pointermove", dx)
      await page.waitForTimeout(40)
    }
    await fire("pointerup", 180)
    const panel = page.getByRole("button", { name: /Adiar 1 h/ }).first()
    await expect(panel).toBeVisible()
    expect(Math.round((await panel.boundingBox())!.width)).toBe(76)
    await panel.click()
    await expect(page.getByText("Adiado em 1 hora.")).toBeVisible()
  })

  test("Atrasados shows 3 rows and a 'Ver mais' row; the bulk action says 'Tudo p/ amanhã'", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    const group = page.locator('[data-group="atrasados"]')
    await expect(group.getByRole("button", { name: /Tudo p\/ amanhã/ })).toBeVisible()
    await expect(group.getByRole("button", { name: /Ver mais 2 atrasados/ })).toBeVisible()
    await group.getByRole("button", { name: /Ver mais 2 atrasados/ }).click()
    await expect(group.getByRole("button", { name: /Ver mais/ })).toHaveCount(0)
  })

  test("every row control and link is at least 44 px (the checkbox through its hit area)", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    const checks = page.getByRole("checkbox")
    const total = await checks.count()
    expect(total).toBeGreaterThan(4)
    for (let i = 0; i < Math.min(total, 6); i++) {
      await checks.nth(i).scrollIntoViewIfNeeded()
      const box = (await checks.nth(i).boundingBox())!
      // A tap 20 px from the centre, in every direction, still lands on the checkbox.
      for (const [dx, dy] of [[20, 0], [-20, 0], [0, 20], [0, -20]]) {
        const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.getAttribute("role"), [box.x + box.width / 2 + dx, box.y + box.height / 2 + dy])
        expect(hit).toBe("checkbox")
      }
    }
    for (const link of await page.locator('[data-testid="seu-dia-list"] a:visible').all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(43.5)
  })

  test("quick add is for desktop and tablet only", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    await expect(page.getByLabel("Adicionar ao dia")).toBeHidden()
  })
})

test.describe("Seu dia (desktop)", () => {
  test.use(desktop)

  test("complete a task, then undo", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    const summary = page.getByTestId("seu-dia-summary")
    await expect(summary).toContainText("2 de 18 feitos")
    await page.getByRole("checkbox", { name: /Revisar proposta do cliente/ }).click()
    await expect(page.getByText("Tarefa concluída").first()).toBeVisible()
    await expect(summary).toContainText("3 de 18 feitos")
    await page.getByRole("button", { name: "Desfazer" }).first().click()
    await expect(summary).toContainText("2 de 18 feitos")
  })

  test("reschedule every overdue task to tomorrow, with undo", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    const group = page.locator('[data-group="atrasados"]')
    await expect(group.getByRole("heading", { name: "Atrasados" })).toBeVisible()
    await expect(group).toContainText("5")
    await group.getByRole("button", { name: "Reagendar tudo para amanhã" }).click()
    await expect(page.getByText(/4 tarefas reagendadas para amanhã/)).toBeVisible()
    await expect(group).toContainText("1") // only the bill is left
    await page.getByRole("button", { name: "Desfazer" }).first().click()
    await expect(group.locator("h3 + span")).toHaveText("5")
  })

  test("a group's fold survives a reload", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    const habits = page.locator('[data-group="habitos"]')
    const toggle = habits.getByRole("button", { name: /Hábitos/ }).first()
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await page.reload()
    await expect(page.locator('[data-group="habitos"]').getByRole("button", { name: /Hábitos/ }).first()).toHaveAttribute("aria-expanded", "false")
  })

  test("the 'agora' divider sits between the past and the future", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    const y = async (locator: ReturnType<Page["locator"]>) => (await locator.first().boundingBox())!.y
    const past = await y(page.getByText("Revisar proposta do cliente", { exact: true }))
    const divider = await y(page.locator("[data-now]"))
    const future = await y(page.getByText("Ligar para o banco", { exact: true }))
    expect(past).toBeLessThan(divider)
    expect(divider).toBeLessThan(future)
  })

  test("a quantity habit has − and +; quick add is available", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    const habit = page.locator('[data-habit-qty="h3"]')
    await expect(habit).toContainText("1,25 de 2,5 L")
    await habit.getByRole("button", { name: /Adicionar/ }).click()
    await expect(habit).not.toContainText("1,25 de 2,5 L")
    await habit.getByRole("button", { name: /Remover/ }).click()
    await expect(habit).toContainText("1,25 de 2,5 L")
    await expect(page.getByLabel("Adicionar ao dia")).toBeVisible()
  })

  test("hover reveals the postpone actions; the module cards can sit beside Seu dia", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await openFixture(page)
    const seuDia = (await page.locator('[data-panel="seu-dia"]').boundingBox())!
    const cards = (await page.getByTestId("module-cards").boundingBox())!
    expect(cards.x).toBeGreaterThan(seuDia.x + seuDia.width - 1)
    // The Agenda link is a ghost link here and the calendar icon button is for phones only.
    await expect(page.getByRole("link", { name: "Agenda" }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: "Abrir agenda" })).toBeHidden()
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Part D: the assistant is a Pro feature that lives in the sidebar.

test.describe("assistant entry by plan", () => {
  const plans = { free: "free", pro: "pro" } as const

  test("Free, expanded: the upgrade card, no assistant entry, no floating button", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!, [{ name: "dev_plan", value: plans.free }, { name: SIDEBAR_COOKIE, value: "true" }])
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto("/dashboard")
    await expect(page.getByText("Desbloqueie o Plano Pro")).toBeVisible({ timeout: 60000 })
    await expect(page.getByTestId("assistant-card")).toHaveCount(0)
    await expect(page.getByText("Assistente virtual")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Abrir o assistente/ })).toHaveCount(0)
  })

  test("Pro, expanded: the assistant card replaces the upgrade card and opens the assistant", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!, [{ name: "dev_plan", value: plans.pro }, { name: SIDEBAR_COOKIE, value: "true" }])
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto("/dashboard")
    const card = page.getByTestId("assistant-card")
    await expect(card).toBeVisible({ timeout: 60000 })
    await expect(card).toContainText("Assistente virtual")
    await expect(card).toContainText("Pergunte ou peça algo")
    await expect(page.getByText("Desbloqueie o Plano Pro")).toHaveCount(0)
    await card.click()
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("collapsed rail: Pro has the 44 px assistant icon, Free the upgrade icon", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!, [{ name: "dev_plan", value: plans.pro }, { name: SIDEBAR_COOKIE, value: "false" }])
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/dashboard")
    const icon = page.getByTestId("assistant-rail-button")
    await expect(icon).toBeVisible({ timeout: 60000 })
    expect(Math.round((await icon.boundingBox())!.width)).toBe(44)
    await expect(icon).toHaveAccessibleName("Assistente virtual")
    await context.addCookies([{ name: "dev_plan", value: "free", url: baseURL! }])
    await page.reload()
    await expect(page.locator("[data-sidebar=sidebar]").getByRole("link", { name: "Fazer upgrade" })).toBeVisible({ timeout: 60000 })
    await expect(page.getByTestId("assistant-rail-button")).toHaveCount(0)
  })

  for (const plan of ["free", "pro"] as const) {
    test(`phone drawer (${plan}): the right entry at the top, 44 px or more`, async ({ page, context, baseURL }) => {
      await consent(context, baseURL!, [{ name: "dev_plan", value: plan }])
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto("/dashboard")
      await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button").last().click({ timeout: 60000 })
      const drawer = page.getByRole("dialog")
      if (plan === "pro") {
        const card = drawer.getByTestId("assistant-card")
        await expect(card).toBeVisible()
        expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        await expect(drawer.getByText("Desbloqueie o Plano Pro")).toHaveCount(0)
      } else {
        await expect(drawer.getByText("Desbloqueie o Plano Pro")).toBeVisible()
        await expect(drawer.getByTestId("assistant-card")).toHaveCount(0)
      }
    })
  }
})

// ---------------------------------------------------------------------------------------------------------------------
// Part E: the notifications panel is capped and scrolls inside.

test.describe("notifications panel", () => {
  for (const [width, height] of [
    [360, 740],
    [390, 844],
    [768, 900],
    [1280, 900],
  ] as const) {
    test(`30 notifications: the panel never exceeds its cap at ${width}px, the header stays, the page behind stays`, async ({ page, context, baseURL }) => {
      await consent(context, baseURL!)
      await page.setViewportSize({ width, height })
      await page.goto("/design-system/notificacoes")
      await page.getByRole("button", { name: /^Notificações/ }).click({ timeout: 60000 })
      const panel = page.locator("[data-slot=popover-content]")
      await expect(panel).toBeVisible()
      const cap = width < 768 ? height * 0.8 : Math.min(480, height * 0.7)
      expect((await panel.boundingBox())!.height).toBeLessThanOrEqual(cap + 1)

      const region = page.getByRole("region", { name: "Lista de notificações" })
      await expect(region).toHaveAttribute("tabindex", "0")
      expect(await region.evaluate((el) => getComputedStyle(el).overscrollBehaviorY)).toBe("contain")
      expect(await region.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)

      const header = page.getByText("Notificações", { exact: true }).first()
      const before = (await header.boundingBox())!.y
      await region.hover()
      await page.mouse.wheel(0, 600)
      await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
      expect((await header.boundingBox())!.y).toBe(before)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      // The hairline under the header appears only once the list has scrolled.
      expect(await header.evaluate((el) => getComputedStyle(el.parentElement!).borderBottomColor)).not.toBe("rgba(0, 0, 0, 0)")
    })
  }

  test("keyboard: the region takes focus and scrolls with the arrow keys; Esc closes", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto("/design-system/notificacoes")
    await page.getByRole("button", { name: /^Notificações/ }).click({ timeout: 60000 })
    const region = page.getByRole("region", { name: "Lista de notificações" })
    await region.focus()
    await expect(region).toBeFocused()
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("PageDown")
    await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    await page.keyboard.press("Escape")
    await expect(page.locator("[data-slot=popover-content]")).toHaveCount(0)
  })

  test("more than 50 notifications: the first 50, then Carregar mais", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto("/design-system/notificacoes?n=80")
    await page.getByRole("button", { name: /^Notificações/ }).click({ timeout: 60000 })
    const region = page.getByRole("region", { name: "Lista de notificações" })
    await expect(region.locator("li")).toHaveCount(50)
    await region.getByRole("button", { name: "Carregar mais" }).click()
    await expect(region.locator("li")).toHaveCount(80)
  })

  test("empty: the message fits and there is no scroll region", async ({ page, context, baseURL }) => {
    await consent(context, baseURL!)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/design-system/notificacoes?n=0")
    await page.getByRole("button", { name: /^Notificações/ }).click({ timeout: 60000 })
    await expect(page.getByText("Nada novo por aqui.")).toBeVisible()
  })
})
