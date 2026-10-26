// App shell: icon rail on tablet, per-user collapse cookie, top bar action, mobile Mais sheet
// Needs the prototype dev server (see docs/PROTOTYPE.md):  node tests/e2e/shell.mjs
import { chromium } from "@playwright/test"
const base = "http://localhost:3100"
const browser = await chromium.launch()
const results = []
const problems = []
const ok = (n, p) => results.push(`${p ? "PASS" : "FAIL"}  ${n}`)

// tablet: icon rail by default
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } })
  await ctx.addInitScript(() => localStorage.setItem("theme", "dark"))
  const page = await ctx.newPage()
  page.on("pageerror", (e) => problems.push("tablet " + e.message.slice(0, 160)))
  await page.goto(base + "/hoje", { waitUntil: "networkidle" })
  await page.waitForTimeout(800)
  const state = await page.locator('[data-slot="sidebar"]').first().getAttribute("data-state")
  ok("tablet starts as an icon rail", state === "collapsed")
  await ctx.close()
}

// desktop: collapse, remember per user, expand
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => localStorage.setItem("theme", "dark"))
  const page = await ctx.newPage()
  page.on("pageerror", (e) => problems.push("desktop " + e.message.slice(0, 160)))
  await page.goto(base + "/rotina", { waitUntil: "networkidle" })
  const sidebar = page.locator('[data-slot="sidebar"]').first()
  ok("desktop starts expanded", (await sidebar.getAttribute("data-state")) === "expanded")
  await page.getByRole("button", { name: "Recolher menu" }).click()
  await page.waitForTimeout(500)
  ok("collapse works", (await sidebar.getAttribute("data-state")) === "collapsed")
  const cookies = await ctx.cookies()
  ok("state stored in a per-user cookie", cookies.some((c) => c.name.startsWith("sidebar_state_") && c.value === "false"))
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  ok("state restored after reload", (await page.locator('[data-slot="sidebar"]').first().getAttribute("data-state")) === "collapsed")
  await page.getByRole("link", { name: "Tarefas" }).first().hover()
  await page.waitForTimeout(500)
  ok("rail shows tooltips", (await page.getByRole("tooltip").count()) >= 1)
  // top bar contextual button + notifications
  await page.getByRole("button", { name: "Expandir menu" }).click()
  await page.waitForTimeout(400)
  await page.getByRole("button", { name: "Novo hábito" }).click()
  await page.waitForTimeout(400)
  ok("top bar primary button opens the screen's dialog", (await page.getByRole("dialog").getByText("Novo hábito").count()) >= 1)
  await page.keyboard.press("Escape")
  await ctx.close()
}

// mobile: "Mais" sheet with groups and the WhatsApp card; compact top bar
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true })
  await ctx.addInitScript(() => localStorage.setItem("theme", "light"))
  const page = await ctx.newPage()
  page.on("pageerror", (e) => problems.push("mobile " + e.message.slice(0, 160)))
  await page.goto(base + "/rotina", { waitUntil: "networkidle" })
  ok("mobile has no floating sidebar", (await page.locator('[data-slot="sidebar-container"]').first().isVisible()) === false)
  await page.getByRole("button", { name: "Mais" }).click()
  await page.waitForTimeout(600)
  ok("Mais sheet lists the three groups", (await page.getByText("Organização", { exact: true }).count()) === 1 && (await page.getByText("Vida", { exact: true }).count()) === 1)
  ok("Mais sheet has the WhatsApp card", (await page.getByText("Conecte seu WhatsApp").count()) === 1)
  await ctx.close()
}

await browser.close()
console.log(results.join("\n"))
console.log(problems.length ? [...new Set(problems)].join("\n") : "no page errors")
