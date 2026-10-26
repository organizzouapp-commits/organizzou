// Browser checks for the Tasks UI using the fictional /design-system/tarefas preview.
// Run with the dev server up:  node tests/e2e/tarefas-preview.mjs
import { chromium } from "@playwright/test"
const browser = await chromium.launch()
const results = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name} ${extra}`)

// ---- desktop: search, filters, drag and drop
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto("http://localhost:3000/design-system/tarefas", { waitUntil: "networkidle" })
  await page.getByLabel("Buscar tarefas").fill("relatorio")
  ok("search ignores accents", (await page.getByText("Enviar relatório semanal").count()) === 1 && (await page.getByText("Planejar as férias").count()) === 0)
  ok("drag is disabled while filtering", (await page.getByText("Para arrastar tarefas").count()) === 1)
  await page.getByLabel("Buscar tarefas").fill("")

  const card = page.getByRole("button", { name: /Marcar consulta de rotina/ }).first()
  const target = page.getByRole("region", { name: "Em andamento" })
  const from = await card.boundingBox()
  const to = await target.boundingBox()
  await page.mouse.move(from.x + 60, from.y + 15)
  await page.mouse.down()
  await page.mouse.move(from.x + 120, from.y + 30, { steps: 6 })
  await page.mouse.move(to.x + 100, to.y + 120, { steps: 14 })
  await page.mouse.up()
  await page.waitForTimeout(800)
  // the preview has no session, so the server action answers with the expired-session toast after the optimistic move
  ok("dropping a card calls the move action", (await page.getByText(/Identificador inválido|Sua sessão expirou/).count()) >= 1)

  await page.getByRole("tab", { name: /Lista/ }).click()
  ok("list view shows sections", (await page.getByRole("region", { name: "A fazer" }).count()) === 1)
  await page.getByRole("tab", { name: /Calendário/ }).click()
  ok("calendar view shows the month grid", (await page.getByRole("grid", { name: /Calendário de tarefas/ }).count()) === 1)
  await page.getByRole("button", { name: "Filtros" }).click()
  ok("filters popover opens", (await page.getByText("Mostrar concluídas").count()) === 1)
  await page.keyboard.press("Escape")
  await page.keyboard.press("Control+k")
  await page.close()
}

// ---- mobile: swipe on list rows (touch)
{
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await page.goto("http://localhost:3000/design-system/tarefas?visao=lista", { waitUntil: "networkidle" })
  const row = page.getByRole("button", { name: /Pagar a conta de luz/ }).first()
  const box = await row.boundingBox()
  const cdp = await context.newCDPSession(page)
  async function swipe(dx) {
    const y = box.y + box.height / 2
    const x0 = dx > 0 ? box.x + 40 : box.x + box.width - 40
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] })
    for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (dx * i) / 8, y }] })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  }
  await swipe(-150)
  await page.waitForTimeout(500)
  ok("swipe left asks for delete confirmation", (await page.getByRole("alertdialog").count()) === 1)
  await page.getByRole("button", { name: "Cancelar" }).click()
  await page.waitForTimeout(700)
  await swipe(150)
  await page.waitForTimeout(600)
  ok("swipe right completes the task (action fired)", (await page.getByText(/Identificador inválido|Sua sessão expirou/).count()) >= 1)
  await context.close()
}
await browser.close()
console.log(results.join("\n"))
