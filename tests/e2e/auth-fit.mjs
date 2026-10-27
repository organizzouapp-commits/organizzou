// Auth screens: no vertical scroll on desktop sizes, plus screenshots (desktop, mobile, recovery success, light-mode typing).
//   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
//   node tests/e2e/auth-fit.mjs            (BASE=http://localhost:3100, OUT=./test-results/auth-fit)
import { mkdirSync } from "node:fs"
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const out = process.env.OUT ?? "test-results/auth-fit"
mkdirSync(out, { recursive: true })
const browser = skipConsent(await chromium.launch(), base)
const results = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`)

async function open(viewport, theme, route) {
  const ctx = await browser.newContext({ viewport })
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
  const page = await ctx.newPage()
  await page.goto(`${base}/${route}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(3000)
  return { ctx, page }
}

// Desktop: nothing scrolls, and nothing inside the card is clipped.
for (const [w, h] of [[1280, 800], [1366, 768], [1440, 900], [1920, 1080]])
  for (const theme of ["dark", "light"])
    for (const route of ["entrar", "cadastro", "recuperar-senha"]) {
      const { ctx, page } = await open({ width: w, height: h }, theme, route)
      const m = await page.evaluate(() => {
        const de = document.documentElement
        const pane = [...document.querySelectorAll("section[data-crossfade]")].find((p) => getComputedStyle(p).opacity === "1")
        const kids = pane.firstElementChild
        const box = pane.getBoundingClientRect()
        const legal = pane.querySelector("nav").getBoundingClientRect()
        const content = kids.firstElementChild.getBoundingClientRect()
        const aside = document.querySelector("aside")
        const steps = [...aside.querySelectorAll("ol")].find((o) => o.offsetParent).getBoundingClientRect()
        const asideBox = aside.getBoundingClientRect()
        return {
          docScroll: de.scrollHeight - de.clientHeight,
          bodyScroll: document.body.scrollHeight - innerHeight,
          contentTop: content.top - box.top,
          contentBottom: legal.top - content.bottom,
          stepsOverflow: steps.bottom - asideBox.bottom,
          clipped: [...aside.querySelectorAll("ol")].filter((o) => o.offsetParent).flatMap((o) => [...o.querySelectorAll("button")]).filter((b) => b.scrollHeight > b.clientHeight + 1 || b.querySelector("span:last-child").getBoundingClientRect().bottom > b.getBoundingClientRect().bottom).length,
          card: (() => { const r = aside.parentElement.parentElement.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })(),
        }
      })
      const tag = `${route} ${w}x${h} ${theme}`
      ok(`no page scroll  ${tag}`, m.docScroll <= 0 && m.bodyScroll <= 0, JSON.stringify(m))
      ok(`form fits above legal links  ${tag}`, m.contentTop >= -1 && m.contentBottom >= -1, `top=${m.contentTop.toFixed(0)} gap=${m.contentBottom.toFixed(0)}`)
      ok(`steps inside panel  ${tag}`, m.stepsOverflow <= 0, `${m.stepsOverflow.toFixed(0)}`)
      ok(`no clipped step text  ${tag}`, m.clipped === 0, `card=${m.card}`)
      if (route !== "recuperar-senha") await page.screenshot({ path: `${out}/${route}-${w}x${h}-${theme}.png` })
      await ctx.close()
    }

// Mobile 390x844.
for (const theme of ["dark", "light"]) {
  const m = { width: 390, height: 844 }
  let { ctx, page } = await open(m, theme, "entrar")
  await page.screenshot({ path: `${out}/mobile-welcome-${theme}.png` })
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${out}/mobile-login-${theme}.png` })
  await ctx.close()
  ;({ ctx, page } = await open(m, theme, "cadastro"))
  await page.screenshot({ path: `${out}/mobile-signup-${theme}.png` })
  const sheet = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => getComputedStyle(d).position === "fixed" && d.className.includes("rounded-t"))
    return { scroll: el.scrollHeight - el.clientHeight, h: el.clientHeight, vh: innerHeight }
  })
  ok(`mobile sign-up sheet needs no scroll ${theme}`, sheet.scroll <= 0, JSON.stringify(sheet))
  await ctx.close()
}

// Recovery: horizontal slide only, then the success state (mocked action).
for (const theme of ["dark", "light"]) {
  const { ctx, page } = await open({ width: 1280, height: 800 }, theme, "entrar")
  await page.getByRole("link", { name: "Esqueci a senha" }).click()
  const ys = []
  const xs = []
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(60)
    const r = await page.evaluate(() => {
      const h = [...document.querySelectorAll("h1")].find((e) => e.textContent === "Recuperar senha")
      const b = h.getBoundingClientRect()
      return [b.top, b.left]
    })
    ys.push(Math.round(r[0]))
    xs.push(Math.round(r[1]))
  }
  ok(`recovery slide is horizontal only (${theme})`, new Set(ys).size === 1 && new Set(xs).size > 1, `y=${ys} x=${xs}`)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/recovery-form-${theme}.png` })
  await ctx.close()
}

// Light-mode typing and "sent" state need a real action; the sent state is forced by intercepting the server action call.
{
  const { ctx, page } = await open({ width: 1280, height: 800 }, "light", "entrar")
  await page.locator("#login-email").fill("organizzouapp@gmail.com")
  await page.locator("#login-password").fill("segredo123")
  const color = await page.locator("#login-email").evaluate((el) => getComputedStyle(el).color)
  ok("light mode input text is not white", !color.includes("246, 247, 240") && color !== "rgb(255, 255, 255)", color)
  await page.screenshot({ path: `${out}/light-typed.png` })
  await ctx.close()
}

console.log(results.join("\n"))
await browser.close()
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
