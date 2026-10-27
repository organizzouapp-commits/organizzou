// Coming-soon page (/): CTA -> /login with a .4s hover/active animation, footer readable over the photo (contrast >= 4.5:1).
//   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
//   node tests/e2e/coming-soon.mjs      (BASE=http://localhost:3100, OUT=./test-results/coming-soon)
import { mkdirSync } from "node:fs"
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const out = process.env.OUT ?? "test-results/coming-soon"
mkdirSync(out, { recursive: true })
const browser = skipConsent(await chromium.launch(), base)
const results = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`)

async function open(viewport, theme, extra = {}) {
  const ctx = await browser.newContext({ viewport, ...extra })
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
  const page = await ctx.newPage()
  await page.goto(`${base}/`, { waitUntil: "networkidle" })
  await page.waitForTimeout(2500)
  return { ctx, page }
}

// Worst-case WCAG contrast of each footer text against the rendered photo behind it (text hidden, background sampled).
async function footerContrast(page) {
  await page.addStyleTag({ content: "footer p, footer p *, footer nav, footer nav * { color: transparent !important; text-decoration-color: transparent !important }" })
  await page.waitForTimeout(100)
  const bg = (await page.screenshot()).toString("base64")
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForTimeout(2500)
  return page.evaluate(async (bgB64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${bgB64}`
    await img.decode()
    const dpr = img.width / innerWidth
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)

    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
    const rgba = (css) => {
      probe.clearRect(0, 0, 1, 1)
      probe.fillStyle = css
      probe.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
      return { r, g, b, a: a / 255 }
    }
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

    const targets = [
      ["copyright", document.querySelector("footer p")],
      ["reserved (bold)", document.querySelector("footer p strong")],
      ["terms link", document.querySelectorAll("footer nav a")[0]],
      ["privacy link", document.querySelectorAll("footer nav a")[1]],
    ]
    const out = []
    for (const [name, el] of targets) {
      if (!el) { out.push([name + " (element missing)", 0]); continue }
      const color = rgba(getComputedStyle(el).color)
      const box = el.getBoundingClientRect()
      const x = Math.max(0, Math.floor(box.left * dpr))
      const y = Math.max(0, Math.floor(box.top * dpr))
      const w = Math.max(1, Math.min(img.width - x, Math.floor(box.width * dpr)))
      const h = Math.max(1, Math.min(img.height - y, Math.floor(box.height * dpr)))
      const data = ctx.getImageData(x, y, w, h).data
      let worst = Infinity
      for (let i = 0; i < data.length; i += 4 * 3) {
        const px = { r: data[i], g: data[i + 1], b: data[i + 2] }
        const blended = { r: color.r * color.a + px.r * (1 - color.a), g: color.g * color.a + px.g * (1 - color.a), b: color.b * color.a + px.b * (1 - color.a) }
        const l1 = lum(blended), l2 = lum(px)
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
        if (ratio < worst) worst = ratio
      }
      out.push([name, Math.round(worst * 100) / 100])
    }
    return out
  }, bg)
}

for (const [w, h, extra] of [[1440, 900, {}], [390, 844, { deviceScaleFactor: 2, hasTouch: true }]])
  for (const theme of ["dark", "light"]) {
    const { ctx, page } = await open({ width: w, height: h }, theme, extra)
    const tag = `${w}x${h} ${theme}`

    const m = await page.evaluate(() => ({ v: document.documentElement.scrollHeight - innerHeight, hx: document.documentElement.scrollWidth - innerWidth }))
    ok(`no horizontal scroll  ${tag}`, m.hx <= 0, JSON.stringify(m))
    if (w >= 1024) ok(`no vertical scroll  ${tag}`, m.v <= 0, JSON.stringify(m))

    const cta = page.getByRole("link", { name: "Entrar no Organizzou" })
    ok(`CTA is a link to /login  ${tag}`, (await cta.getAttribute("href")) === "/login")
    ok(`waitlist dialog trigger is gone  ${tag}`, (await page.getByRole("button", { name: /Avise-me/ }).count()) === 0)
    ok(`capsule text ends with "Já tem acesso?"  ${tag}`, (await page.locator("main p").first().innerText()).trim().endsWith("Já tem acesso?"))
    await page.screenshot({ path: `${out}/coming-soon-${tag.replace(" ", "-")}.png` })

    if (w >= 1024 && theme === "dark") {
      const css = await cta.evaluate((el) => {
        const s = getComputedStyle(el)
        return { prop: s.transitionProperty, dur: s.transitionDuration, ease: s.transitionTimingFunction }
      })
      ok("CTA transition covers scale/background/shadow/color at .4s with the brand easing", ["scale", "background-color", "box-shadow", "color"].every((p) => css.prop.includes(p)) && css.dur.split(", ").every((d) => d === "0.4s") && css.ease.includes("cubic-bezier(0.2, 0.8, 0.2, 1)"), JSON.stringify(css))
      await cta.hover()
      await page.waitForTimeout(120)
      const mid = Number((await cta.evaluate((el) => getComputedStyle(el).scale)).split(" ")[0])
      await page.waitForTimeout(600)
      const end = Number((await cta.evaluate((el) => getComputedStyle(el).scale)).split(" ")[0])
      ok("hover animates smoothly to scale 1.05 (mid-transition value is between)", mid > 1.0001 && mid < 1.0499 && Math.abs(end - 1.05) < 0.001, `mid=${mid} end=${end}`)
      await page.screenshot({ path: `${out}/cta-hover-${tag.replace(" ", "-")}.png` })
      await page.mouse.down()
      await page.waitForTimeout(700)
      const pressed = Number((await cta.evaluate((el) => getComputedStyle(el).scale)).split(" ")[0])
      ok("active scales to 0.98", Math.abs(pressed - 0.98) < 0.001, `scale=${pressed}`)
      await page.mouse.move(5, 5) // release elsewhere: no click, stay on the page
      await page.mouse.up()
    }

    const contrast = await footerContrast(page)
    for (const [name, ratio] of contrast) ok(`footer ${name} contrast >= 4.5  ${tag}`, ratio >= 4.5, `${ratio}:1`)
    await page.screenshot({ path: `${out}/footer-${tag.replace(" ", "-")}.png`, clip: { x: 0, y: Math.max(0, h - 220), width: w, height: 220 } })
    await ctx.close()
  }

// Click navigates to /login (desktop and mobile).
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const { ctx, page } = await open({ width: w, height: h }, "dark")
  await page.getByRole("link", { name: "Entrar no Organizzou" }).click()
  await page.waitForURL("**/login", { timeout: 15000 }).then(() => ok(`click navigates to /login  ${w}x${h}`, true)).catch(() => ok(`click navigates to /login  ${w}x${h}`, false, page.url()))
  await ctx.close()
}

console.log(results.join("\n"))
await browser.close()
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
