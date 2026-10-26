// Auth split card: sliding panel, back/forward, validation, mobile layout
// Needs the prototype dev server (see docs/PROTOTYPE.md):  node tests/e2e/auth.mjs
import { chromium } from "@playwright/test"
const base = "http://localhost:3100"
import { skipConsent } from "./consent.mjs"
const browser = skipConsent(await chromium.launch(), base)
const problems = []
const results = []
const ok = (n, p) => {
  const line = `${p ? "PASS" : "FAIL"}  ${n}`
  results.push(line)
  if (process.env.VERBOSE) console.log(line)
}

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
    ok(`/entrar ${theme}/${size}: shows the welcome screen, sheet closed`, (await page.getByRole("button", { name: "Criar conta" }).isVisible()) && (await page.getByRole("heading", { name: "Entrar", level: 1 }).count()) === 0)
    await page.getByRole("button", { name: "Criar conta" }).click()
    await page.waitForURL("**/cadastro")
    await page.waitForTimeout(800)
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
  ok("no password checklist", (await page.getByText("Mínimo de 8 caracteres").count()) === 0 && (await page.getByText("Letra maiúscula").count()) === 0)
  await page.locator("#signup-password").fill("abc")
  await page.locator("#signup-phone").focus()
  await page.waitForTimeout(300)
  ok("one inline password error after blur", (await page.getByText("Use pelo menos 8 caracteres.").count()) === 1)
  await page.locator("#signup-password").fill("Abc12345")
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
// mobile: welcome screen, bottom sheet, logo as the back button, tap outside, browser Back, direct entries
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
  const page = await ctx.newPage()
  await page.goto(base + "/entrar", { waitUntil: "networkidle" })
  await page.waitForTimeout(1800)
  const sheet = page.locator("div.max-lg\\:fixed").first()
  const welcomeBar = page.getByRole("button", { name: "Entrar", exact: true })
  ok(`mobile ${theme}: welcome shows headline, subtitle and the two bottom buttons`, (await page.getByText("Tudo do seu dia em um só lugar.").isVisible()) && (await welcomeBar.isVisible()) && (await page.getByRole("button", { name: "Criar conta" }).isVisible()))
  const bar = await page.getByRole("button", { name: "Criar conta" }).boundingBox()
  ok(`mobile ${theme}: bottom bar fills the right half to the bottom edge`, bar && bar.y + bar.height >= 843 && bar.height >= 70 && bar.x >= 190)
  ok(`mobile ${theme}: steps are hidden`, (await page.getByRole("button", { name: "Veja seu dia" }).isVisible()) === false)
  await welcomeBar.click()
  await page.waitForTimeout(900)
  const box = await sheet.boundingBox()
  ok(`mobile ${theme}: sheet opens over ~72% of the height, URL /entrar`, box && box.y < 844 * 0.32 && box.y > 844 * 0.05 && page.url().endsWith("/entrar"), `top ${box?.y}`)
  const logoBtn = page.getByRole("button", { name: "Voltar para o início" })
  const logoBox = await logoBtn.boundingBox()
  ok(`mobile ${theme}: logo is centered in the photo above the sheet, 40px tall, and there is no Voltar button`, logoBox && logoBox.y + logoBox.height <= box.y + 2 && Math.abs(logoBox.x + logoBox.width / 2 - 195) < 3 && (await page.getByRole("button", { name: "Voltar", exact: true }).count()) === 0 && Math.abs((await logoBtn.locator("img:visible").boundingBox()).height - 40) < 1.5)
  ok(`mobile ${theme}: no horizontal scroll`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1)
  await logoBtn.click()
  await page.waitForTimeout(900)
  ok(`mobile ${theme}: tapping the logo closes the sheet`, (await page.getByText("Tudo do seu dia em um só lugar.").isVisible()) && (await sheet.boundingBox().then((b) => !b || b.y >= 843)))
  await page.getByRole("button", { name: "Criar conta" }).click()
  await page.waitForTimeout(900)
  ok(`mobile ${theme}: Criar conta opens the sheet in sign-up mode`, page.url().endsWith("/cadastro") && (await page.getByRole("heading", { name: "Criar conta", level: 1 }).isVisible()))
  await page.goBack()
  await page.waitForTimeout(900)
  ok(`mobile ${theme}: browser Back closes the sheet`, await page.getByText("Tudo do seu dia em um só lugar.").isVisible())
  // tapping the photo outside the sheet closes it too
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForTimeout(900)
  await page.mouse.click(30, 120)
  await page.waitForTimeout(900)
  ok(`mobile ${theme}: tapping outside the sheet closes it`, await page.getByText("Tudo do seu dia em um só lugar.").isVisible())
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForTimeout(900)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(900)
  ok(`mobile ${theme}: Esc closes the sheet`, await page.getByText("Tudo do seu dia em um só lugar.").isVisible())
  // forgot password inside the sheet: same stage, the URL follows
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForTimeout(900)
  await page.getByRole("link", { name: "Esqueci a senha" }).click()
  await page.waitForTimeout(700)
  ok(`mobile ${theme}: forgot password swaps inside the sheet`, page.url().endsWith("/recuperar-senha") && (await page.getByRole("heading", { name: "Recuperar senha", level: 1 }).isVisible()))
  await page.getByRole("link", { name: "Voltar para entrar" }).click()
  await page.waitForTimeout(700)
  ok(`mobile ${theme}: and back to login`, page.url().endsWith("/entrar") && (await page.getByRole("heading", { name: "Entrar", level: 1 }).isVisible()))
  await page.keyboard.press("Escape")
  await page.waitForTimeout(900)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForTimeout(900)
  // switching inside the sheet
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForTimeout(900)
  await page.getByRole("link", { name: "Criar conta" }).click()
  await page.waitForTimeout(900)
  ok(`mobile ${theme}: switch link changes the mode inside the sheet`, page.url().endsWith("/cadastro") && (await page.getByRole("heading", { name: "Criar conta", level: 1 }).isVisible()))
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(base + "/cadastro", { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  ok("mobile: direct /cadastro opens the sheet in sign-up mode", await page.getByRole("heading", { name: "Criar conta", level: 1 }).isVisible())
  await page.goto(base + "/entrar?next=/tarefas", { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  ok("mobile: ?next= opens the sheet in login mode", await page.getByRole("heading", { name: "Entrar", level: 1 }).isVisible())
  await ctx.close()
}
// desktop: logo at 40px, forgot password <-> login swap without remounting, placeholders
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(base + "/entrar", { waitUntil: "load" })
  await page.waitForTimeout(3000)
  const panelLogo = page.getByRole("complementary", { name: "Organizzou" }).locator("img:visible").first()
  ok("desktop: panel logo is 40px tall", Math.abs((await panelLogo.boundingBox()).height - 40) < 1.5)
  ok("placeholders on login", (await page.getByPlaceholder("Seu e-mail aqui").first().isVisible()) && (await page.getByPlaceholder("Sua senha aqui").first().isVisible()))
  await page.evaluate(() => (window.__marker = "same-shell"))
  const loginHeight = await page.locator("#login-email").evaluate((el) => el.closest("div.grid").getBoundingClientRect().height)
  await page.getByRole("link", { name: "Esqueci a senha" }).click()
  await page.waitForTimeout(150)
  const mid = await page.locator("#login-email").evaluate((el) => getComputedStyle(el.closest("div[class*=col-start-1]")).opacity)
  await page.waitForTimeout(700)
  ok("desktop: forgot password fades in the same shell (no remount, URL follows)", page.url().endsWith("/recuperar-senha") && (await page.evaluate(() => window.__marker)) === "same-shell" && (await page.getByRole("heading", { name: "Recuperar senha", level: 1 }).isVisible()) && Number(mid) < 1, `login opacity mid-transition ${mid}`)
  const forgotHeight = await page.locator("#forgot-email").evaluate((el) => el.closest("div.grid").getBoundingClientRect().height)
  ok("desktop: the stage height follows the visible form", Math.abs(forgotHeight - loginHeight) > 20, `${loginHeight} -> ${forgotHeight}`)
  await page.getByRole("link", { name: "Voltar para entrar" }).click()
  await page.waitForTimeout(900)
  ok("desktop: back to login", page.url().endsWith("/entrar") && (await page.getByRole("heading", { name: "Entrar", level: 1 }).isVisible()))
  await page.goBack()
  await page.waitForTimeout(900)
  ok("desktop: browser back returns to the recovery form", page.url().endsWith("/recuperar-senha") && (await page.getByRole("heading", { name: "Recuperar senha", level: 1 }).isVisible()))
  await ctx.close()
}
// mobile loads the mobile background only
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await ctx.newPage()
  const requested = []
  page.on("request", (r) => /auth-background/.test(r.url()) && requested.push(decodeURIComponent(r.url())))
  await page.goto(base + "/entrar", { waitUntil: "load" })
  await page.waitForTimeout(1500)
  ok("mobile: only the mobile background is downloaded", requested.length > 0 && requested.every((u) => u.includes("auth-background-mobile")), requested.join(" | "))
  await ctx.close()
}
// desktop entrance: the card animates in once, and sliding does not replay the reveal
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(base + "/entrar", { waitUntil: "domcontentloaded" })
  const early = await page.evaluate(() => {
    const el = document.querySelector("h1")
    return el ? getComputedStyle(el).opacity : "none"
  })
  await page.waitForTimeout(3600)
  ok("entrance: items start hidden and the intro flag is removed afterwards", Number(early) < 1 && (await page.locator("[data-intro]").count()) === 0, `early opacity ${early}`)
  await ctx.close()
}
