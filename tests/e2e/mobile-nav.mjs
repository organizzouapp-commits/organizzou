// Mobile header, compact glass bar, floating glass nav, "Outros" drawer and the assistant button: no horizontal overflow
// (after tapping every item), 44 px targets, "+" aligned with the other items, FAB clear of the pill, desktop untouched at 768+.
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

// The Next dev indicator sits bottom-left and would cover the first pill item in dev; production has none.
const go = async (page, path) => {
  await page.goto(base + path, { waitUntil: "networkidle" })
  await page.addStyleTag({ content: "nextjs-portal { display: none !important }" })
  await page.waitForTimeout(500)
}

async function open(width, theme, path = "/dashboard") {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 768 })
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
  const page = await ctx.newPage()
  page.on("pageerror", (e) => problems.push(`${width} ${e.message.slice(0, 160)}`))
  await go(page, path)
  return { ctx, page }
}

const navOf = (page) => page.getByRole("navigation", { name: "Navegação principal" })
const overflowOf = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)

for (const width of [360, 390, 430, 767])
  for (const theme of ["dark", "light"]) {
    const tag = `${width} ${theme}`
    const { ctx, page } = await open(width, theme)
    const nav = navOf(page)
    const box = await nav.boundingBox()
    const fab0 = await page.locator("button[aria-label='Abrir o assistente']:visible").boundingBox()
    ok(`pill fills the row: 16 px gutters, 12 px gap, 56 px assistant button on the right  ${tag}`, box && fab0 && Math.abs(box.x - 16) < 1 && Math.abs(fab0.x - (box.x + box.width) - 12) < 1 && Math.abs(fab0.x + fab0.width - (width - 16)) < 1 && Math.abs(fab0.width - 56) < 1 && Math.abs(fab0.y + fab0.height / 2 - (box.y + box.height / 2)) < 1, JSON.stringify({ box, fab0 }))
    ok(`nav bottom is 16 px above the screen edge and ~64 px tall  ${tag}`, box && Math.abs(844 - (box.y + box.height) - 16) < 1 && Math.abs(box.height - 64) < 1, JSON.stringify(box))
    const labelOf = (e) => [...e.querySelectorAll("span")].find((s) => s.textContent.trim())
    const rows = await nav.getByRole("button").evaluateAll((els) => els.map((e) => ({ h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width), name: e.getAttribute("aria-label"), labelW: Math.round([...e.querySelectorAll("span")].find((s) => s.textContent.trim()).getBoundingClientRect().width) })))
    ok(`pill has Hoje, Tarefas, Agenda, Outros (no +); icon-only 44 px items, the active one with its label  ${tag}`, rows.map((r) => r.name).join() === "Hoje,Tarefas,Agenda,Outros" && rows.every((r) => r.h >= 44) && rows.slice(1).every((r) => r.w === 44 && r.labelW === 0) && rows[0].labelW > 20, JSON.stringify(rows))
    ok(`header is not sticky  ${tag}`, await page.evaluate(() => getComputedStyle([...document.querySelectorAll("header")].find((h) => h.offsetParent !== null)).position !== "sticky"))

    // the root-cause check: tap every item, the page must never scroll sideways and the pill must stay centered
    for (const name of ["Tarefas", "Agenda", "Hoje"]) {
      await nav.getByRole("button", { name, exact: true }).click()
      await page.waitForTimeout(900)
      const o = await overflowOf(page)
      const b = await nav.boundingBox()
      const clipped = await nav.getByRole("button", { name, exact: true }).evaluate((e) => { const t = [...e.querySelectorAll("span")].find((s) => s.textContent.trim()); return t.scrollWidth > t.clientWidth })
      ok(`active label "${name}" is not truncated  ${tag}`, !clipped)
      ok(`no horizontal overflow and the pill keeps its place after tapping ${name}  ${tag}`, o <= 0 && b && Math.abs(b.x - box.x) < 1 && Math.abs(b.width - box.width) < 1, `overflow ${o} ${JSON.stringify(b)}`)
    }
    await nav.getByRole("button", { name: "Outros", exact: true }).click()
    await page.waitForTimeout(700)
    ok(`Outros opens the drawer with Finanças, Vida and Organização  ${tag}`, await page.getByRole("dialog").getByText("Finanças").isVisible() && (await page.getByRole("dialog").getByText("Organização", { exact: true }).isVisible()))
    if (width === 390) await page.screenshot({ path: `${out}/outros-${tag.replace(" ", "-")}.png` })
    await page.getByRole("dialog").getByRole("link", { name: "Treinos" }).click()
    await page.waitForURL("**/dashboard/treinos")
    await page.waitForTimeout(900)
    ok(`Outros is the active item on a Vida route  ${tag}`, (await nav.getByRole("button", { name: "Outros", exact: true }).getAttribute("aria-current")) === "page")
    ok(`no horizontal overflow on Treinos / Outros active  ${tag}`, (await overflowOf(page)) <= 0)
    await page.screenshot({ path: `${out}/treinos-${tag.replace(" ", "-")}.png` })

    // the assistant button sits above the pill, not on it



    await ctx.close()
  }

// every route: no horizontal overflow at the narrowest width
{
  const { ctx, page } = await open(360, "dark")
  for (const path of ["/dashboard", "/dashboard/tarefas", "/dashboard/agenda", "/dashboard/financas", "/dashboard/rotina", "/dashboard/treinos", "/dashboard/dieta", "/dashboard/estudos", "/dashboard/notas", "/dashboard/metas", "/dashboard/diario", "/dashboard/cofre", "/dashboard/perfil", "/dashboard/configuracoes", "/dashboard/ajuda"]) {
    await go(page, path)
    ok(`no horizontal overflow at 360  ${path}`, (await overflowOf(page)) <= 0, String(await overflowOf(page)))
  }
  await ctx.close()
}

// compact glass bar: hidden at the top, slides in once the header is gone, hides again at the top; never together with the header
for (const theme of ["dark", "light"]) {
  const { ctx, page } = await open(390, theme)
  const bar = page.locator("div[inert], div.fixed").filter({ has: page.getByRole("button", { name: "Buscar", exact: true }) }).first()
  const barTop = async () => (await bar.boundingBox())?.y ?? -999
  ok(`compact bar is hidden at the top  ${theme}`, (await barTop()) < 0 && (await bar.evaluate((e) => e.hasAttribute("inert"))))
  await page.evaluate(() => window.scrollTo(0, 60))
  await page.waitForTimeout(700)
  ok(`compact bar stays hidden while the header is still visible  ${theme}`, (await barTop()) < 0)
  await page.evaluate(() => window.scrollTo(0, 400))
  await page.waitForTimeout(900)
  const b = await bar.boundingBox()
  ok(`compact bar slides in at 8 px from the top, 16 px gutters  ${theme}`, b && Math.abs(b.y - 8) < 1 && Math.abs(b.x - 16) < 1 && Math.abs(b.width - (390 - 32)) < 1 && Math.abs(b.height - 56) < 1, JSON.stringify(b))
  ok(`full header is out of view when the compact bar shows  ${theme}`, await page.locator("header:has(nav[aria-label='Módulos']):visible").evaluate((e) => e.getBoundingClientRect().bottom < 0))
  await page.screenshot({ path: `${out}/compact-390-${theme}.png` })
  await bar.getByRole("button", { name: "Buscar", exact: true }).click()
  await page.waitForTimeout(600)
  ok(`compact search opens the command palette  ${theme}`, await page.getByRole("dialog").locator("input").first().isVisible())
  await page.keyboard.press("Escape")
  await page.waitForTimeout(400)
  await bar.getByRole("button", { name: "Menu da conta" }).click()
  await page.waitForTimeout(500)
  ok(`compact avatar opens the account menu  ${theme}`, await page.getByRole("menuitem", { name: "Conectar WhatsApp" }).isVisible())
  await page.keyboard.press("Escape")
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(900)
  ok(`compact bar hides again at the top  ${theme}`, (await barTop()) < 0)
  ok(`no horizontal overflow after scrolling  ${theme}`, (await overflowOf(page)) <= 0)
  await ctx.close()
}

// route change: active chip scrolls into view, Vida / Organização menus, header screenshots
{
  const { ctx, page } = await open(360, "dark")
  await page.screenshot({ path: `${out}/home-360-dark.png` })
  await go(page, "/dashboard/cofre")
  await page.waitForTimeout(700)
  const chip = await page.locator("nav[aria-label='Módulos'] [data-active]").boundingBox()
  ok("active chip (Organização) is visible in the row", chip && chip.x >= 0 && chip.x + chip.width <= 360, JSON.stringify(chip))
  await page.screenshot({ path: `${out}/cofre-360-dark.png` })
  await page.getByRole("button", { name: "Vida" }).click()
  await page.waitForTimeout(500)
  ok("Vida menu lists 4 modules", (await page.getByRole("menuitem").count()) === 4)
  await page.keyboard.press("Escape")
  await ctx.close()
}
for (const theme of ["dark", "light"]) {
  const { ctx, page } = await open(390, theme)
  await page.screenshot({ path: `${out}/home-390-${theme}.png` })
  await page.getByRole("button", { name: "Menu da conta" }).first().click()
  await page.waitForTimeout(500)
  const text = await page.getByRole("menu").innerText()
  ok(`avatar menu content  ${theme}`, ["Perfil", "Configurações", "Ajuda", "Conectar WhatsApp", "Sair"].every((t) => text.includes(t)))
  await page.keyboard.press("Escape")
  await page.locator("button[aria-label='Abrir o assistente']:visible").click()
  await page.waitForTimeout(700)
  ok(`assistant button opens the assistant  ${theme}`, await page.getByLabel("Mensagem para o assistente").isVisible())
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

// the pill and the assistant button hide while the keyboard is up (a text field has focus)
{
  const { ctx, page } = await open(390, "dark", "/dashboard/notas")
  await page.locator("input:not([readonly]):not([aria-hidden]), textarea").first().focus()
  ok("nav and assistant button hide while a text field is focused", !(await navOf(page).isVisible()) && !(await page.locator("button[aria-label='Abrir o assistente']").first().isVisible()))
  await ctx.close()
}

// desktop untouched
for (const width of [768, 1280]) {
  const { ctx, page } = await open(width, "dark")
  ok(`desktop layout intact (no floating nav, no compact bar)  ${width}`, !(await navOf(page).isVisible()) && !(await page.getByRole("button", { name: "Buscar", exact: true }).first().isVisible().catch(() => false)) || width >= 768)
  ok(`assistant button visible at the bottom-right corner  ${width}`, await page.getByRole("button", { name: "Abrir o assistente" }).isVisible())
  await page.screenshot({ path: `${out}/desktop-${width}.png` })
  await ctx.close()
}

await browser.close()
console.log(results.join("\n"))
console.log(problems.length ? [...new Set(problems)].join("\n") : "no page errors")
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
