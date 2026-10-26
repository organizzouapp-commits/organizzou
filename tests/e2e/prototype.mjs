// Browser checks for the clickable prototype. Needs a dev server with the auth bypass:
//   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
//   node tests/e2e/prototype.mjs            (BASE=http://localhost:3100 by default)
import { chromium } from "@playwright/test"

const base = process.env.BASE ?? "http://localhost:3100"
const PAGES = ["/hoje", "/tarefas", "/rotina", "/agenda", "/financas", "/treinos", "/dieta", "/estudos", "/notas", "/cofre", "/metas", "/diario", "/configuracoes"]
const results = []
const ok = (name, pass) => results.push(`${pass ? "PASS" : "FAIL"}  ${name}`)

import { skipConsent } from "./consent.mjs"
const browser = skipConsent(await chromium.launch(), base)

// ---- every screen renders in both themes and sizes without console errors or sideways scrolling
for (const [theme, size, viewport] of [
  ["dark", "375", { width: 375, height: 812 }],
  ["light", "1280", { width: 1280, height: 900 }],
]) {
  const context = await browser.newContext({ viewport, hasTouch: size === "375" })
  await context.addInitScript((t) => localStorage.setItem("theme", t), theme)
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)))
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)))
  for (const path of PAGES) {
    await page.goto(base + path, { waitUntil: "networkidle" })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ok(`${path} @${size} ${theme}: no errors, no horizontal scroll`, errors.length === 0 && overflow <= 1)
    errors.length = 0
  }
  await context.close()
}

// ---- Tasks: search, drag and drop between lists, views
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(base + "/tarefas", { waitUntil: "networkidle" })
  await page.getByLabel("Buscar tarefas").fill("proposta")
  ok("tasks: search narrows the board", (await page.getByText("Revisar proposta do cliente").count()) === 1 && (await page.getByText("Entrevistar candidata").count()) === 0)
  await page.getByLabel("Buscar tarefas").fill("")

  const card = page.getByText("Atualizar planilha de custos").first()
  const from = await card.boundingBox()
  const target = await page.getByRole("region", { name: "Em andamento" }).boundingBox()
  await page.mouse.move(from.x + 20, from.y + 5)
  await page.mouse.down()
  await page.mouse.move(from.x + 40, from.y + 20, { steps: 5 })
  await page.mouse.move(target.x + 120, target.y + 150, { steps: 15 })
  await page.mouse.up()
  await page.waitForTimeout(600)
  ok("tasks: dropped card stays in the new list", (await page.getByRole("region", { name: "Em andamento" }).getByText("Atualizar planilha de custos").count()) === 1)

  await page.getByRole("tab", { name: /Lista/ }).click()
  ok("tasks: list view", (await page.getByRole("region", { name: "A fazer" }).count()) === 1)
  await page.getByRole("tab", { name: /Calendário/ }).click()
  ok("tasks: calendar view", (await page.getByRole("grid", { name: /Calendário de tarefas/ }).count()) === 1)
  await page.close()
}

// ---- Assistant: records, asks before saving, confirms before deleting
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(base + "/hoje", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Abrir o assistente" }).click()
  const box = page.getByLabel("Mensagem para o assistente")
  await box.fill("Gastei 45 no mercado")
  await box.press("Enter")
  await page.waitForTimeout(1100)
  ok("assistant: registers an expense", (await page.getByText("Gasto de R$ 45,00 registrado em Mercado.").count()) === 1)
  await box.fill("terminei o treino")
  await box.press("Enter")
  await page.waitForTimeout(1100)
  ok("assistant: asks before saving an ambiguous workout", (await page.getByRole("button", { name: "Treino C — Pernas" }).count()) === 1)
  await box.fill("apagar a tarefa de pagar IPTU")
  await box.press("Enter")
  await page.waitForTimeout(1100)
  ok("assistant: asks confirmation before deleting", (await page.getByRole("button", { name: "Sim, apagar" }).count()) === 1)
  await page.close()
}

// ---- Global search (Ctrl+K)
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(base + "/hoje", { waitUntil: "networkidle" })
  await page.waitForTimeout(800)
  await page.keyboard.press("Control+k")
  await page.getByPlaceholder("Buscar em tudo ou ir para…").fill("proposta")
  await page.waitForTimeout(300)
  ok("search: finds content across modules", (await page.getByRole("option").count()) > 0)
  await page.close()
}

await browser.close()
console.log(results.join("\n"))
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1)
