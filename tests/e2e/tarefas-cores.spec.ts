/**
 * Tarefas, "pills, label colors, mobile Calendário" round. Mobile first, then desktop. On the development fixture
 * /design-system/tarefas (in-memory API):
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test tarefas-cores
 */
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const PREPARAR = "d0000000-0000-4000-8000-000000000010"

async function consent(context: BrowserContext, baseURL: string, theme = "dark") {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t)
    } catch {}
  }, theme)
}

async function open(page: Page, path = "/design-system/tarefas?view=kanban") {
  await page.goto(path)
  await expect(page.locator('button[aria-label^="Quadro:"]')).toBeVisible({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
}


/** WCAG contrast of `fg` over the stacked `layers` (CSS colors, bottom first), resolved through a canvas so oklab/alpha just work. */
async function contrast(page: Page, layers: string[], fg: string) {
  return page.evaluate(
    ({ layers, fg }) => {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!
      const paint = (color: string) => {
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
        return [r, g, b]
      }
      ctx.clearRect(0, 0, 1, 1)
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

const computed = (locator: Locator, prop: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)

test.describe("desktop 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))

  test("quadro name: click edits in place, Enter saves, Esc cancels, empty reverts, chevron opens the menu, no rename dialog", async ({ page }) => {
    await open(page)
    const name = page.getByRole("button", { name: /^Quadro:/ })
    await name.click()
    const field = page.getByLabel("Nome do quadro")
    await expect(field).toBeVisible()
    await field.fill("Trabalho")
    await field.press("Enter")
    await expect(page.getByRole("button", { name: "Quadro: Trabalho" })).toBeVisible()
    await page.getByRole("button", { name: "Quadro: Trabalho" }).click()
    await page.getByLabel("Nome do quadro").fill("Descartar")
    await page.getByLabel("Nome do quadro").press("Escape")
    await expect(page.getByRole("button", { name: "Quadro: Trabalho" })).toBeVisible()
    await page.getByRole("button", { name: "Quadro: Trabalho" }).click()
    await page.getByLabel("Nome do quadro").fill("   ")
    await page.getByLabel("Nome do quadro").press("Enter")
    await expect(page.getByRole("button", { name: "Quadro: Trabalho" })).toBeVisible()
    // The chevron is its own 44 px circle and opens the quadro menu; "Renomear" there focuses the same inline field.
    const chevron = page.getByRole("button", { name: "Trocar de quadro" })
    await chevron.click()
    await expect(page.getByRole("menuitem", { name: "Novo quadro" })).toBeVisible()
    await page.getByRole("menuitem", { name: "Renomear" }).click()
    await expect(page.getByLabel("Nome do quadro")).toBeFocused()
    await expect(page.getByRole("dialog", { name: "Renomear quadro" })).toHaveCount(0)
    expect((await page.getByLabel("Nome do quadro").evaluate((el) => (el as HTMLInputElement).maxLength))).toBe(60)
  })

  test("the list grip is visible without hover, inline in the 56 px header", async ({ page }) => {
    await open(page)
    const grip = page.getByRole("button", { name: "Mover a lista A fazer" })
    await expect(grip).toBeVisible()
    expect(Number(await computed(grip, "opacity"))).toBeGreaterThanOrEqual(0.69)
    const header = (await page.locator('section[aria-label="A fazer"] header').boundingBox())!
    const g = (await grip.boundingBox())!
    const chevron = (await page.getByRole("button", { name: "Recolher A fazer" }).boundingBox())!
    expect(Math.round(header.height)).toBe(56)
    expect(g.x + g.width).toBeLessThanOrEqual(chevron.x + 1)
    expect(g.y).toBeGreaterThanOrEqual(header.y)
    expect(g.y + g.height).toBeLessThanOrEqual(header.y + header.height)
  })

  test("Nova lista: 1.5px dashed border, label contrast >= 4.5:1, same width as a list, 56px high", async ({ page }) => {
    await open(page)
    const tile = page.locator("[data-new-list] button")
    await expect(tile).toBeVisible()
    expect(await computed(tile, "border-top-style")).toBe("dashed")
    // Chrome snaps 1.5px borders to whole device pixels at 1x, so the rule itself is checked.
    expect(await tile.evaluate((el) => el.className)).toContain("border-[1.5px]")
    const box = (await page.locator("[data-new-list]").boundingBox())!
    const col = (await page.locator("section[data-column]").first().boundingBox())!
    expect(Math.round(box.height)).toBe(56)
    expect(Math.abs(box.width - col.width)).toBeLessThanOrEqual(2)
    const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const ratio = await contrast(page, [body, await computed(tile, "background-color")], await computed(tile, "color"))
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  for (const [w, h] of [[1280, 720], [1440, 900], [1920, 1080]] as const) {
    for (const volume of [0, 30]) {
      test(`Kanban fits ${w}x${h} (volume ${volume}): bottom edge and composer visible, last card clears the footer`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h })
        await open(page, `/design-system/tarefas?view=kanban&volume=${volume}`)
        const board = (await page.getByTestId("kanban-board").boundingBox())!
        expect(board.y + board.height).toBeLessThanOrEqual(h)
        expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(1)
        const column = page.locator("section[data-column]").first()
        const footer = column.locator("[data-list-scroll] + div")
        await expect(footer).toBeInViewport({ ratio: 1 })
        const colBox = (await column.boundingBox())!
        expect(colBox.y + colBox.height).toBeLessThanOrEqual(h - 8)
        const scroller = column.locator("[data-list-scroll]")
        if (volume > 0) expect(await scroller.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(200)
        await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight))
        await page.waitForTimeout(250)
        const scrollBox = (await scroller.boundingBox())!
        const footerBox = (await footer.boundingBox())!
        // The footer is a sibling under the scroll body, never on top of it.
        expect(scrollBox.y + scrollBox.height).toBeLessThanOrEqual(footerBox.y + 1)
        const last = (await column.locator("[data-task-id]").last().boundingBox())!
        expect(last.y + last.height).toBeLessThanOrEqual(footerBox.y + 1)
      })
    }
  }

  test("collapsed lists keep their width, are exactly header high, sit in one row and persist after reload", async ({ page }) => {
    await open(page)
    const widthBefore = (await page.locator("section[data-column]").first().boundingBox())!.width
    await page.getByRole("button", { name: "Recolher A fazer" }).click()
    await page.getByRole("button", { name: "Recolher Em andamento" }).click()
    await page.waitForTimeout(600)
    const collapsed = page.locator("section[data-collapsed]")
    await expect(collapsed).toHaveCount(2)
    const boxes = await collapsed.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width) })))
    expect(boxes[0].y).toBe(boxes[1].y)
    for (const b of boxes) {
      expect(b.h).toBe(56)
      expect(Math.abs(b.w - widthBefore)).toBeLessThanOrEqual(2)
    }
    await expect(page.getByRole("button", { name: "Expandir A fazer" })).toHaveAttribute("aria-expanded", "false")
    await page.reload()
    await expect(page.locator("section[data-collapsed]")).toHaveCount(2, { timeout: 60000 })
  })

  test("picker footer: Gerenciar and Adicionar, sticky and outside the scrolling list", async ({ page }) => {
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Tags", exact: true }).click()
    const picker = page.getByTestId("picker-tag")
    const footer = picker.locator("[data-picker-footer]")
    await expect(footer.getByRole("button", { name: "Gerenciar" })).toBeVisible()
    await expect(footer.getByRole("button", { name: "Adicionar" })).toBeVisible()
    await expect(picker.getByRole("button", { name: "Gerenciar", exact: true })).toHaveCount(1)
    const list = (await picker.locator("[data-picker-list]").boundingBox())!
    const foot = (await footer.boundingBox())!
    expect(list.y + list.height).toBeLessThanOrEqual(foot.y + 1)
    const [a, b] = await footer.getByRole("button").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)))
    expect(Math.abs(a - b)).toBeLessThanOrEqual(2)
  })





  test("all buttons stay pills in the pickers (computed radius)", async ({ page }) => {
    await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Tags", exact: true }).click()
    const footerButtons = page.getByTestId("picker-tag").locator("[data-picker-footer] button")
    for (const radius of await footerButtons.evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius)))) expect(radius).toBeGreaterThanOrEqual(18)
  })
})

for (const width of [360, 390, 430]) {
  test.describe(`phone ${width}`, () => {
    test.use({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true })
    test.beforeEach(async ({ context, baseURL }) => consent(context, baseURL!))





    test("pickers are bottom sheets with the footer and 52px rows", async ({ page }) => {
      await open(page, `/design-system/tarefas?view=kanban&tarefa=${PREPARAR}`)
      await page.getByRole("button", { name: "Tags", exact: true }).click()
      await page.waitForTimeout(800)
      const picker = page.getByTestId("picker-tag")
      await expect(picker.locator("[data-picker-footer]").getByRole("button", { name: "Gerenciar" })).toBeVisible()
      const row = (await picker.locator("[data-picker-item]").first().boundingBox())!
      expect(Math.round(row.height)).toBeGreaterThanOrEqual(52)
      const foot = (await picker.locator("[data-picker-footer]").boundingBox())!
      expect(foot.y + foot.height).toBeLessThanOrEqual(800)
    })
  })
}
