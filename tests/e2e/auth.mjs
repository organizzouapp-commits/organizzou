// Auth split card: sliding panel, back/forward, validation, mobile layout
// Needs the prototype dev server (see docs/PROTOTYPE.md):  node tests/e2e/auth.mjs
import { chromium } from "@playwright/test"
const base = "http://localhost:3100"
import { skipConsent } from "./consent.mjs"
const browser = skipConsent(await chromium.launch(), base)
const problems = []
const results = []
const ok = (n, p) => results.push(`${p ? "PASS" : "FAIL"}  ${n}`)

for (const [theme, size, vp] of [["dark", "d", { width: 1280, height: 900 }], ["light", "d", { width: 1280, height: 900 }], ["dark", "m", { width: 375, height: 812 }], ["light", "m", { width: 375, height: 812 }]]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: size === "m" })
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
  const page = await ctx.newPage()
  page.on("console", (m) => m.type() === "error" && problems.push(`[${theme}/${size}] ${m.text().slice(0, 200)}`))
  page.on("pageerror", (e) => problems.push(`[${theme}/${size}] pageerror ${e.message.slice(0, 200)}`))

  await page.goto(base + "/entrar", { waitUntil: "networkidle" })
  await page.waitForTimeout(700)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(`/entrar ${theme}/${size}: no horizontal scroll`, overflow <= 1)

  if (size === "d") {
    const panel = page.getByRole("complementary", { name: "Organizzou" })
    const before = await panel.boundingBox()
    await page.getByRole("link", { name: "Criar conta" }).first().click()
    await page.waitForURL("**/cadastro")
    await page.waitForTimeout(900)
    const after = await panel.boundingBox()
    ok(`panel slides left→right on "Criar conta" (${theme})`, before && after && after.x > before.x + 300)
    await page.goBack()
    await page.waitForURL("**/entrar")
    await page.waitForTimeout(900)
    const back = await panel.boundingBox()
    ok(`browser back slides it back (${theme})`, back && Math.abs(back.x - before.x) < 2)
    await page.getByRole("link", { name: "Esqueci a senha" }).click()
    await page.waitForURL("**/recuperar-senha")
    await page.waitForTimeout(700)
    const forgot = await panel.boundingBox()
    ok(`recovery keeps the panel on the left (${theme})`, forgot && Math.abs(forgot.x - before.x) < 2)
  } else {
    await page.getByRole("link", { name: "Criar conta" }).first().click()
    await page.waitForURL("**/cadastro")
    await page.waitForTimeout(700)
    const o2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ok(`/cadastro ${theme}/${size}: no horizontal scroll`, o2 <= 1)
  }
  await ctx.close()
}

// validation + phone mask + password checklist
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(base + "/cadastro", { waitUntil: "networkidle" })
  await page.waitForTimeout(700)
  await page.getByLabel("Telefone").fill("11912345678")
  ok("phone mask", (await page.getByLabel("Telefone").inputValue()) === "(11) 91234-5678")
  await page.locator("#signup-password").fill("Abc12345")
  ok("checklist reaches 4/4", (await page.getByText("(atendido)").count()) === 4)
  await page.locator("#signup-password").locator("xpath=..").getByRole("button", { name: "Mostrar senha" }).click()
  ok("eye toggles visibility", (await page.locator("#signup-password").getAttribute("type")) === "text")
  await page.locator("form").filter({ has: page.locator("#signup-password") }).getByRole("button", { name: "Criar conta" }).click()
  await page.waitForTimeout(500)
  ok("zod errors in pt-BR", (await page.getByText("Informe seu nome completo.").count()) === 1)
  await ctx.close()
}
// highlight steps: different copy per screen, clickable, glass hover
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(base + "/entrar", { waitUntil: "networkidle" })
  await page.waitForTimeout(700)
  ok("login steps", (await page.getByRole("button", { name: "Receba lembretes" }).count()) === 1)
  const step = page.getByRole("button", { name: "Fale com o assistente" })
  await step.click()
  ok("clicking a step makes it active", (await step.getAttribute("aria-current")) === "step")
  await page.getByRole("link", { name: "Criar conta" }).first().click()
  await page.waitForURL("**/cadastro")
  await page.waitForTimeout(900)
  ok("sign-up steps", (await page.getByRole("button", { name: "Conecte seu WhatsApp" }).count()) === 1)
  await ctx.close()
}
// mobile: segmented control switches screens, steps hidden
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(base + "/entrar", { waitUntil: "networkidle" })
  ok("mobile hides the steps", (await page.getByRole("button", { name: "Veja seu dia" }).isVisible()) === false)
  await page.getByRole("navigation", { name: "Entrar ou criar conta" }).getByRole("link", { name: "Criar conta" }).click()
  await page.waitForURL("**/cadastro")
  ok("segmented control marks Criar conta", (await page.getByRole("navigation", { name: "Entrar ou criar conta" }).getByRole("link", { name: "Criar conta" }).getAttribute("aria-current")) === "page")
  await ctx.close()
}
await browser.close()
console.log(results.join("\n"))
console.log(problems.length ? [...new Set(problems)].join("\n") : "no console problems")
