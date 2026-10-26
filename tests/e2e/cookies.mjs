// Cookie consent: first visit shows the bar, a choice is remembered, "Personalizar" saves per-category choices.
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
  await page.waitForTimeout(600)
  ok("bar shows on the first visit", await bar(page).isVisible())
  await page.getByRole("button", { name: "Aceitar todos" }).click()
  await page.waitForTimeout(300)
  const c = await stored(ctx)
  ok("accept all stores analytics+marketing", c?.analytics === true && c?.marketing === true && c?.necessary === true && c?.version === 1)
  ok("cookie is Lax with a ~12 month expiry", (await ctx.cookies()).some((x) => x.name === "organizzou_consent" && x.sameSite === "Lax" && x.expires - Date.now() / 1000 > 360 * 86400))
  ok("bar disappears", (await bar(page).count()) === 0)
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForTimeout(600)
  ok("bar does not come back after reload", (await bar(page).count()) === 0)
  await page.goto(base + "/rotina", { waitUntil: "networkidle" })
  await page.waitForTimeout(600)
  ok("bar does not show inside the app either", (await bar(page).count()) === 0)
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(base + "/entrar", { waitUntil: "networkidle" })
  await page.waitForTimeout(600)
  await page.getByRole("button", { name: "Personalizar" }).click()
  const dialog = page.getByRole("dialog")
  ok("Personalizar opens the dialog", await dialog.isVisible())
  ok("essential switch is on and disabled", (await dialog.getByRole("switch", { name: /Essenciais/ }).isDisabled()) && (await dialog.getByRole("switch", { name: /Essenciais/ }).isChecked()))
  await dialog.getByRole("switch", { name: /Análise/ }).click()
  await page.keyboard.press("Escape")
  await page.waitForTimeout(400)
  ok("Esc closes only the dialog", (await dialog.count()) === 0 && (await bar(page).isVisible()))
  await page.getByRole("button", { name: "Personalizar" }).click()
  await page.getByRole("dialog").getByRole("switch", { name: /Análise/ }).click()
  await page.getByRole("button", { name: "Salvar preferências" }).click()
  await page.waitForTimeout(400)
  const c = await stored(ctx)
  ok("custom choice is saved", c?.analytics === true && c?.marketing === false)
  ok("bar is gone after saving", (await bar(page).count()) === 0)
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(base + "/entrar", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Recusar opcionais" }).click()
  const c = await stored(ctx)
  ok("reject optional stores false/false", c?.analytics === false && c?.marketing === false)
  await page.goto(base + "/configuracoes?aba=seguranca", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Personalizar" }).click()
  ok("settings reopens the preferences dialog", await page.getByRole("dialog").getByText("Preferências de cookies").isVisible())
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(base + "/entrar", { waitUntil: "networkidle" })
  await page.waitForTimeout(600)
  const box = await bar(page).boundingBox()
  ok("mobile bar is a full-width bottom sheet", box && Math.abs(box.x) < 1 && box.width >= 389 && box.y + box.height >= 843)
  await ctx.close()
}
await browser.close()
console.log(results.join("\n"))
