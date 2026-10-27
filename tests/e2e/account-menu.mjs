// "Configurações" group (sidebar, rail flyout, avatar menu, mobile "Mais"), sign-out confirmation, Perfil/Ajuda pages,
// and the fake-frost frame: the blurred layer lines up pixel-perfect with the sharp photo, with no blur filters at runtime.
//   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
//   node tests/e2e/account-menu.mjs      (BASE=http://localhost:3100, OUT=./test-results/account)
import { mkdirSync } from "node:fs"
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const out = process.env.OUT ?? "test-results/account"
mkdirSync(out, { recursive: true })
const browser = skipConsent(await chromium.launch(), base)
const results = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`)

async function open(viewport, theme, path, collapsed = false) {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 768 })
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
  const page = await ctx.newPage()
  await page.goto(base + path, { waitUntil: "networkidle" })
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" })
  if (collapsed) {
    await page.getByRole("button", { name: "Recolher menu" }).click()
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(600)
  return { ctx, page }
}
const side = (page) => page.locator("[data-slot='sidebar-inner']")

// ---------- frost: geometry + no runtime blur ----------
for (const [w, h] of [[1440, 900], [1280, 800], [1920, 1080], [1100, 700]]) {
  const { ctx, page } = await open({ width: w, height: h }, "dark", "/dashboard")
  const measure = () =>
    page.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.left * 10) / 10, Math.round(b.top * 10) / 10, Math.round(b.width * 10) / 10, Math.round(b.height * 10) / 10] }
      const sharp = document.querySelector("picture img:not([src*='frost'])")
      const frost = document.querySelector("img[src*='app-bg-frost']")
      const frame = document.querySelector("[data-slot='sidebar-wrapper']")
      const blurred = [...document.querySelectorAll("*")].filter((e) => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== "none") || (s.filter && s.filter !== "none") }).map((e) => e.tagName + "." + String(e.className).slice(0, 40))
      return { vw: innerWidth, vh: innerHeight, sharp: r(sharp), frost: r(frost), frame: r(frame), fit: [getComputedStyle(sharp).objectFit, getComputedStyle(frost).objectFit], pos: [getComputedStyle(sharp).objectPosition, getComputedStyle(frost).objectPosition], blurred }
    })
  let m = await measure()
  ok(`frost layer is viewport-sized and starts at 0,0 (same box as the sharp photo)  ${w}x${h}`, JSON.stringify(m.frost) === JSON.stringify([0, 0, m.vw, m.vh]) && JSON.stringify(m.sharp) === JSON.stringify([0, 0, m.vw, m.vh]), `frost=${m.frost} sharp=${m.sharp}`)
  ok(`same object-fit and focal point  ${w}x${h}`, m.fit[0] === "cover" && m.fit[1] === "cover" && m.pos[0] === m.pos[1], `${m.fit} / ${m.pos}`)
  ok(`no backdrop-filter or filter anywhere  ${w}x${h}`, m.blurred.length === 0, m.blurred.slice(0, 3).join(" | "))
  await page.getByRole("button", { name: "Recolher menu" }).click()
  await page.waitForTimeout(800)
  const m2 = await measure()
  ok(`frame and frost do not move when the sidebar collapses  ${w}x${h}`, JSON.stringify(m2.frost) === JSON.stringify(m.frost) && JSON.stringify(m2.frame) === JSON.stringify(m.frame), `${m.frame} -> ${m2.frame}`)
  await page.setViewportSize({ width: w + 160, height: h + 90 })
  await page.waitForTimeout(500)
  const m3 = await measure()
  ok(`still aligned after a window resize  ${w}x${h}`, JSON.stringify(m3.frost) === JSON.stringify([0, 0, m3.vw, m3.vh]) && JSON.stringify(m3.sharp) === JSON.stringify([0, 0, m3.vw, m3.vh]))
  await ctx.close()
}

// ---------- expanded sidebar group ----------
{
  const { ctx, page } = await open({ width: 1280, height: 800 }, "dark", "/dashboard")
  const trigger = side(page).getByRole("button", { name: "Configurações", exact: true })
  ok("group trigger is closed by default", (await trigger.getAttribute("aria-expanded")) === "false")
  const order = await page.evaluate(() => {
    const inner = document.querySelector("[data-slot='sidebar-inner']")
    const t = [...inner.querySelectorAll("button")].find((b) => b.textContent.trim() === "Configurações")
    const card = [...inner.querySelectorAll("p")].find((p) => p.textContent.includes("Conecte seu WhatsApp"))
    return { trigger: t.getBoundingClientRect().bottom, card: card.getBoundingClientRect().top, cardBottom: inner.getBoundingClientRect().bottom - [...inner.querySelectorAll("a")].find((a) => a.textContent.trim() === "Conectar").getBoundingClientRect().bottom }
  })
  ok("order: Configurações group, then the WhatsApp card as the last element", order.trigger < order.card && order.cardBottom < 40, JSON.stringify(order))
  await trigger.click()
  await page.waitForTimeout(150)
  const mid = await page.evaluate(() => { const c = [...document.querySelectorAll("[data-slot='collapsible-content']")].pop(); return c.getBoundingClientRect().height })
  await page.waitForTimeout(600)
  const full = await page.evaluate(() => { const c = [...document.querySelectorAll("[data-slot='collapsible-content']")].pop(); return c.getBoundingClientRect().height })
  ok("opens with a height animation (0.4s)", mid > 0 && mid < full - 1, `mid=${Math.round(mid)} full=${Math.round(full)}`)
  const names = await side(page).locator("[data-slot='collapsible-content']").last().locator("a, button").allInnerTexts()
  ok("group contains Perfil, Configurações, Ajuda and Sair", JSON.stringify(names.map((n) => n.trim())) === JSON.stringify(["Perfil", "Configurações", "Ajuda", "Sair"]), JSON.stringify(names))
  const fits = await page.evaluate(() => { const n = document.querySelector("[data-slot='sidebar-inner'] nav"); const card = [...document.querySelectorAll("[data-slot='sidebar-inner'] a")].find((a) => a.textContent.trim() === "Conectar").getBoundingClientRect(); return { navOverflow: n.scrollHeight - n.clientHeight, cardInside: card.bottom <= document.querySelector("[data-slot='sidebar-inner']").getBoundingClientRect().bottom } })
  ok("group open at 1280x800: the nav list still fits, bottom block intact", fits.navOverflow <= 0 && fits.cardInside, JSON.stringify(fits))
  await page.screenshot({ path: `${out}/group-open-1280x800-dark.png` })

  // sign-out confirmation
  await side(page).getByRole("button", { name: "Sair", exact: true }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.waitFor({ timeout: 5000 })
  ok("Sair asks for confirmation", (await dialog.innerText()).includes("Deseja sair da sua conta?"))
  await page.screenshot({ path: `${out}/signout-dialog-1280x800-dark.png` })
  await dialog.getByRole("button", { name: "Cancelar" }).click()
  await page.waitForTimeout(400)
  ok("Cancelar keeps you in the app", (await page.getByRole("alertdialog").count()) === 0 && page.url().includes("/dashboard"))

  // pages
  await side(page).getByRole("link", { name: "Perfil", exact: true }).click()
  await page.waitForURL("**/dashboard/perfil")
  await page.getByLabel("Telefone (WhatsApp)").waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
  const pc = { title: await page.title(), h1: await page.getByRole("heading", { name: "Perfil", level: 1 }).count(), nome: await page.getByLabel("Nome").count(), email: await page.getByLabel("E-mail", { exact: true }).count(), tel: await page.getByLabel("Telefone (WhatsApp)").count(), btn: await page.getByRole("button", { name: "Alterar senha" }).count() }
  ok("Perfil: title, heading and fields", pc.title === "Organizzou - Perfil" && pc.h1 === 1 && pc.nome === 1 && pc.email === 1 && pc.tel === 1 && pc.btn === 1, JSON.stringify(pc))
  await page.screenshot({ path: `${out}/perfil-1280x800-dark.png` })
  ok("Perfil: the group stays open on its own page", (await side(page).getByRole("button", { name: "Configurações", exact: true }).getAttribute("aria-expanded")) === "true")
  await side(page).getByRole("link", { name: "Ajuda", exact: true }).click()
  await page.waitForURL("**/dashboard/ajuda")
  await page.waitForTimeout(800)
  ok("Ajuda: title, FAQ and contact", (await page.title()) === "Organizzou - Ajuda" && (await page.getByText("Perguntas frequentes").count()) > 0 && (await page.getByText("Fale com a gente").count()) > 0)
  await page.getByRole("button", { name: "Como conecto meu WhatsApp?" }).click()
  await page.waitForTimeout(500)
  ok("Ajuda: FAQ item expands", (await page.getByText("aba WhatsApp").count()) > 0)
  await page.screenshot({ path: `${out}/ajuda-1280x800-dark.png` })
  await ctx.close()
}

// ---------- full-size screenshots with the group open, both themes ----------
for (const theme of ["dark", "light"])
  for (const [w, h] of [[1440, 900], [1280, 800]]) {
    const { ctx, page } = await open({ width: w, height: h }, theme, "/dashboard")
    await side(page).getByRole("button", { name: "Configurações", exact: true }).click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${out}/group-open-${w}x${h}-${theme}.png` })
    await ctx.close()
    const rail = await open({ width: w, height: h }, theme, "/dashboard", true)
    await rail.page.getByRole("button", { name: "Configurações", exact: true }).click()
    await rail.page.waitForTimeout(600)
    const items = await rail.page.getByRole("dialog").locator("a, button").allInnerTexts()
    ok(`rail flyout lists Perfil, Configurações, Ajuda, Sair  ${w}x${h} ${theme}`, JSON.stringify(items.map((i) => i.trim())) === JSON.stringify(["Perfil", "Configurações", "Ajuda", "Sair"]), JSON.stringify(items))
    const box = await rail.page.getByRole("dialog").boundingBox()
    ok(`rail flyout stays on screen  ${w}x${h} ${theme}`, box && box.y >= 0 && box.y + box.height <= h, JSON.stringify(box))
    await rail.page.screenshot({ path: `${out}/rail-flyout-${w}x${h}-${theme}.png` })
    await rail.ctx.close()
  }

// ---------- avatar menu + mobile Mais ----------
{
  const { ctx, page } = await open({ width: 1440, height: 900 }, "dark", "/dashboard")
  await page.getByRole("button", { name: "Menu da conta" }).click()
  await page.waitForTimeout(400)
  const items = await page.getByRole("menu").getByRole("menuitem").allInnerTexts()
  ok("avatar menu: Perfil, Configurações, Ajuda, Sair", JSON.stringify(items.map((i) => i.trim())) === JSON.stringify(["Perfil", "Configurações", "Ajuda", "Sair"]), JSON.stringify(items))
  await page.getByRole("menuitem", { name: "Sair" }).click()
  ok("avatar menu Sair also confirms", await page.getByRole("alertdialog").getByText("Deseja sair da sua conta?").isVisible())
  await ctx.close()
}
for (const theme of ["dark", "light"]) {
  const { ctx, page } = await open({ width: 390, height: 844 }, theme, "/dashboard")
  await page.getByRole("button", { name: "Mais" }).click()
  await page.waitForTimeout(700)
  const sheet = page.getByRole("dialog")
  const text = await sheet.innerText()
  ok(`mobile "Mais" has Perfil, Configurações, Ajuda, Sair  ${theme}`, ["Perfil", "Configurações", "Ajuda", "Sair"].every((t) => text.includes(t)))
  await page.screenshot({ path: `${out}/mais-sheet-390x844-${theme}.png` })
  await sheet.getByRole("button", { name: "Sair" }).click()
  ok(`mobile Sair confirms  ${theme}`, await page.getByRole("alertdialog").getByText("Deseja sair da sua conta?").isVisible())
  await ctx.close()
}

console.log(results.join("\n"))
await browser.close()
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
