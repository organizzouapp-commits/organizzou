// Cookie consent: first visit shows the bar, a choice is remembered; the settings dialog saves per-category choices.
// Needs the prototype dev server (see docs/PROTOTYPE.md):  node tests/e2e/cookies.mjs
import { chromium } from "@playwright/test"
const base = process.env.BASE ?? "http://localhost:3100"
const browser = await chromium.launch()
const results = []
const ok = (n, p) => results.push(`${p ? "PASS" : "FAIL"}  ${n}`)
const bar = (page) => page.getByRole("region", { name: "Aviso de cookies" })
const stored = async (ctx) => {
  const c = (await ctx.cookies()).find((x) => x.name === "organizzou_consent")
  return c ? JSON.parse(decodeURIComponent(c.value)) : null
}

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(base + "/entrar", { waitUntil: "networkidle" })
  await page.waitForTimeout(700)
  ok("bar shows on the first visit", await bar(page).isVisible())
  const box = await bar(page).boundingBox()
  ok("bar sits bottom-left, 24px from the edges, max 440px", box && Math.abs(box.x - 24) < 1 && Math.abs(900 - (box.y + box.height) - 24) < 1 && box.width <= 441)
  ok("only two buttons, no Personalizar", (await bar(page).getByRole("button").count()) === 2 && (await bar(page).getByRole("button", { name: "Personalizar" }).count()) === 0)
  const [a, b] = await bar(page).getByRole("button").all()
  const [ba, bb] = [await a.boundingBox(), await b.boundingBox()]
  ok("buttons are equal width and 52px tall", Math.abs(ba.width - bb.width) < 1 && Math.abs(ba.height - 52) < 1 && Math.abs(bb.height - 52) < 1)
  await page.getByRole("button", { name: "Aceitar cookies" }).click()
  await page.waitForTimeout(800)
  const c = await stored(ctx)
  ok("accept stores analytics+marketing", c?.analytics === true && c?.marketing === true && c?.necessary === true && c?.version === 1)
  ok("cookie is Lax with a ~12 month expiry", (await ctx.cookies()).some((x) => x.name === "organizzou_consent" && x.sameSite === "Lax" && x.expires - Date.now() / 1000 > 360 * 86400))
  ok("bar leaves after the exit animation", (await bar(page).count()) === 0)
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForTimeout(600)
  ok("bar does not come back after reload", (await bar(page).count()) === 0)
  await page.goto(base + "/rotina", { waitUntil: "networkidle" })
  await page.waitForTimeout(600)
  ok("bar does not show inside the app either", (await bar(page).count()) === 0)
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(base + "/entrar", { waitUntil: "networkidle" })
  await page.waitForTimeout(600)
  await page.getByRole("button", { name: "Não, obrigado" }).click()
  await page.waitForTimeout(800)
  const c = await stored(ctx)
  ok("Não, obrigado stores false/false", c?.analytics === false && c?.marketing === false)
  await page.goto(base + "/configuracoes?aba=seguranca", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Personalizar" }).click()
  const dialog = page.getByRole("dialog")
  ok("settings opens the preferences dialog", await dialog.getByText("Preferências de cookies").isVisible())
  ok("essential switch is on and disabled", (await dialog.getByRole("switch", { name: /Essenciais/ }).isDisabled()) && (await dialog.getByRole("switch", { name: /Essenciais/ }).isChecked()))
  await dialog.getByRole("switch", { name: /Análise/ }).click()
  await page.getByRole("button", { name: "Salvar preferências" }).click()
  await page.waitForTimeout(400)
  const d = await stored(ctx)
  ok("custom choice is saved", d?.analytics === true && d?.marketing === false)
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(base + "/entrar", { waitUntil: "networkidle" })
  await page.waitForTimeout(700)
  const box = await bar(page).boundingBox()
  ok("mobile bar is full width minus 16px margins", box && Math.abs(box.x - 16) < 1 && Math.abs(box.width - 358) < 1 && Math.abs(844 - (box.y + box.height) - 16) < 1)
  const [a, b] = await bar(page).getByRole("button").all()
  ok("mobile buttons stack with the primary on top", (await b.boundingBox()).y < (await a.boundingBox()).y)
  await ctx.close()
}
await browser.close()
console.log(results.join("\n"))
