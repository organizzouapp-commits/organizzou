// Mobile header + floating bottom nav: no horizontal overflow, 44 px targets, desktop untouched at 768+, menus and routes.
//   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
//   node tests/e2e/mobile-nav.mjs      (BASE=http://localhost:3100, OUT=./test-results/mobile-nav)
import { mkdirSync } from "node:fs"
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const out = process.env.OUT ?? "test-results/mobile-nav"
mkdirSync(out, { recursive: true })
const browser = skipConsent(await chromium.launch(), base)
const results = []
const problems = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : "  " + extra}`)

async function open(width, theme, path = "/dashboard") {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 768 })
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
  const page = await ctx.newPage()
  page.on("pageerror", (e) => problems.push(`${width} ${e.message.slice(0, 160)}`))
  await page.goto(base + path, { waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  return { ctx, page }
}

for (const width of [360, 390, 430, 767])
  for (const theme of ["dark", "light"]) {
    const tag = `${width} ${theme}`
    const { ctx, page } = await open(width, theme)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    ok(`no horizontal overflow  ${tag}`, overflow <= 0, String(overflow))
    const nav = page.getByRole("navigation", { name: "Navegação principal" })
    const box = await nav.boundingBox()
    ok(`floating nav fits and is centered  ${tag}`, box && box.x >= 16 - 0.5 && Math.abs(box.x + box.width / 2 - width / 2) < 1, JSON.stringify(box))
    const heights = await nav.getByRole("button").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
    ok(`nav touch targets >= 44  ${tag}`, heights.every((h) => h >= 44), heights.join(","))
    ok(`header is not sticky  ${tag}`, await page.evaluate(() => getComputedStyle(document.querySelector("header")).position !== "sticky"))
    ok(`active nav item is Hoje  ${tag}`, (await nav.getByRole("button", { name: "Hoje" }).getAttribute("aria-current")) === "page")
    await page.screenshot({ path: `${out}/home-${width}-${theme}.png` })
    await ctx.close()
  }

// route change: active chip scrolls into view, active nav item follows
{
  const { ctx, page } = await open(360, "dark")
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Agenda" }).click()
  await page.waitForURL("**/dashboard/agenda")
  await page.waitForTimeout(900)
  const nav = page.getByRole("navigation", { name: "Navegação principal" })
  ok("nav: Agenda becomes active", (await nav.getByRole("button", { name: "Agenda" }).getAttribute("aria-current")) === "page")
  await page.goto(base + "/dashboard/cofre", { waitUntil: "networkidle" })
  await page.waitForTimeout(1200)
  const chip = await page.locator("nav[aria-label='Módulos'] [data-active]").boundingBox()
  ok("active chip (Organização) is visible in the row", chip && chip.x >= 0 && chip.x + chip.width <= 360, JSON.stringify(chip))
  await page.screenshot({ path: `${out}/cofre-360-dark.png` })
  await page.getByRole("button", { name: "Vida" }).scrollIntoViewIfNeeded()
  await page.getByRole("button", { name: "Vida" }).click()
  await page.waitForTimeout(500)
  ok("Vida menu lists 4 modules", (await page.getByRole("menuitem").count()) === 4)
  await page.screenshot({ path: `${out}/vida-menu-360-dark.png` })
  await page.keyboard.press("Escape")
  await ctx.close()
}

// menus and actions
for (const theme of ["dark", "light"]) {
  const { ctx, page } = await open(390, theme)
  await page.getByRole("button", { name: "Menu da conta" }).click()
  await page.waitForTimeout(500)
  const text = await page.getByRole("menu").innerText()
  ok(`avatar menu content  ${theme}`, ["Perfil", "Configurações", "Ajuda", "Conectar WhatsApp", "Sair"].every((t) => text.includes(t)))
  await page.screenshot({ path: `${out}/avatar-390-${theme}.png` })
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Criar novo" }).click()
  await page.waitForTimeout(700)
  ok(`+ opens the quick capture sheet  ${theme}`, await page.getByRole("dialog").getByText("Captura rápida").isVisible())
  await page.screenshot({ path: `${out}/plus-390-${theme}.png` })
  await page.keyboard.press("Escape")
  await page.waitForTimeout(400)
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Assistente" }).click()
  await page.waitForTimeout(700)
  ok(`Assistente opens the assistant  ${theme}`, await page.getByLabel("Mensagem para o assistente").isVisible())
  await page.keyboard.press("Escape")
  await page.waitForTimeout(400)
  await page.locator('input[readonly][aria-label="Buscar em tudo"]').click()
  await page.waitForTimeout(600)
  ok(`search opens the command palette  ${theme}`, await page.getByRole("dialog").locator("input").first().isVisible())
  await page.keyboard.press("Escape")
  await page.waitForTimeout(400)
  const before = await page.evaluate(() => document.documentElement.classList.contains("dark"))
  await page.getByRole("button", { name: "Alternar entre tema claro e escuro" }).click()
  await page.waitForTimeout(600)
  ok(`theme switch toggles  ${theme}`, (await page.evaluate(() => document.documentElement.classList.contains("dark"))) !== before)
  await ctx.close()
}

// the pill hides while the keyboard is up (a text field has focus)
{
  const { ctx, page } = await open(390, "dark", "/dashboard/notas")
  const input = page.locator("input:not([readonly]):not([aria-hidden]), textarea").first()
  if (await input.count()) {
    await input.focus()
    ok("nav hides while a text field is focused", !(await page.getByRole("navigation", { name: "Navegação principal" }).isVisible()))
  }
  await ctx.close()
}

// long title / desktop untouched
{
  const { ctx, page } = await open(360, "dark", "/dashboard/notas")
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ok("long title (Notas e lembretes) does not overflow at 360", overflow <= 0, String(overflow))
  await ctx.close()
}
for (const width of [768, 1280]) {
  const { ctx, page } = await open(width, "dark")
  ok(`desktop layout intact (no floating nav)  ${width}`, !(await page.getByRole("navigation", { name: "Navegação principal" }).isVisible()) && true)
  ok(`assistant FAB visible on desktop  ${width}`, await page.getByRole("button", { name: "Abrir o assistente" }).isVisible())
  await page.screenshot({ path: `${out}/desktop-${width}.png` })
  await ctx.close()
}

await browser.close()
console.log(results.join("\n"))
console.log(problems.length ? [...new Set(problems)].join("\n") : "no page errors")
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
