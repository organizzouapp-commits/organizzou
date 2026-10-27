// App shell layout: frame padding P, fluid content, sidebar groups, collapsed rail centering, hidden scrollbars + screenshots.
//   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
//   node tests/e2e/shell-layout.mjs      (BASE=http://localhost:3100, OUT=./test-results/shell, SHOTS=0 to skip screenshots)
import { mkdirSync } from "node:fs"
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const out = process.env.OUT ?? "test-results/shell"
const shots = process.env.SHOTS !== "0"
mkdirSync(out, { recursive: true })
const browser = skipConsent(await chromium.launch(), base)
const results = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`)

async function open(viewport, theme, path, collapsed) {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 768 })
  await ctx.addInitScript((t) => {
    localStorage.setItem("theme", t)
  }, theme)
  const page = await ctx.newPage()
  await page.goto(base + path, { waitUntil: "networkidle" })
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" })
  if (collapsed) {
    await page.getByRole("button", { name: "Recolher menu" }).click()
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(700)
  return { ctx, page }
}

for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080]]) {
  for (const collapsed of [false, true]) {
    for (const theme of ["dark", "light"]) {
      for (const [name, path] of [["inicio", "/dashboard"], ["tarefas", "/dashboard/tarefas"]]) {
        const { ctx, page } = await open({ width: w, height: h }, theme, path, collapsed)
        const tag = `${name} ${w}x${h} ${collapsed ? "collapsed" : "expanded"} ${theme}`
        const m = await page.evaluate(() => {
          const r = (el) => el.getBoundingClientRect()
          const frame = r(document.querySelector("[data-slot='sidebar-wrapper']"))
          const side = r(document.querySelector("[data-slot='sidebar-inner']"))
          const scroll = document.querySelector("[data-app-scroll]")
          const sc = r(scroll)
          const header = r(document.querySelector("[data-slot='sidebar-inset'] header"))
          const first = scroll.firstElementChild.firstElementChild ? r(scroll.firstElementChild.firstElementChild) : sc
          const cs = getComputedStyle(scroll)
          const nav = document.querySelector("[data-slot='sidebar-inner'] nav")
          return {
            P: Math.round(side.left - frame.left),
            sideTop: Math.round(side.top - frame.top),
            sideBottom: Math.round(frame.bottom - side.bottom),
            headerTop: Math.round(header.top - frame.top),
            contentRight: Math.round(frame.right - sc.right),
            contentBottom: Math.round(frame.bottom - sc.bottom),
            gapToSidebar: Math.round(sc.left - side.right),
            firstLeft: Math.round(first.left - sc.left),
            firstRight: Math.round(sc.right - first.right),
            scrollbarWidth: cs.scrollbarWidth,
            scrollGutter: scroll.offsetWidth - scroll.clientWidth,
            overscroll: cs.overscrollBehaviorY,
            navOverflow: nav ? nav.scrollHeight - nav.clientHeight : null,
            docScroll: document.documentElement.scrollHeight - innerHeight,
          }
        })
        // geometry
        ok(`column starts at the sidebar's top and ends at its bottom  ${tag}`, Math.abs(m.headerTop - m.sideTop) <= 1 && Math.abs(m.contentBottom - m.sideBottom) <= 1, JSON.stringify({ sideTop: m.sideTop, headerTop: m.headerTop, sideBottom: m.sideBottom, contentBottom: m.contentBottom }))
        ok(`right padding equals P (${m.P}px)  ${tag}`, Math.abs(m.contentRight - m.P) <= 1, `right=${m.contentRight}`)
        ok(`content fills the width (no side gutters)  ${tag}`, m.firstLeft <= 1 && m.firstRight <= 1, `left=${m.firstLeft} right=${m.firstRight}`)
        ok(`scrollbar hidden, no gutter, overscroll contained  ${tag}`, m.scrollbarWidth === "none" && m.scrollGutter === 0 && m.overscroll === "contain", `${m.scrollbarWidth}/${m.scrollGutter}/${m.overscroll}`)
        ok(`page itself never scrolls  ${tag}`, m.docScroll <= 0)
        if (!collapsed && h >= 800) ok(`sidebar list fits without its own scroll  ${tag}`, m.navOverflow <= 0, `overflow=${m.navOverflow}`)

        if (collapsed) {
          const rail = await page.evaluate(() => {
            const inner = document.querySelector("[data-slot='sidebar-inner']").getBoundingClientRect()
            const axis = inner.left + inner.width / 2
            const els = [...document.querySelectorAll("[data-slot='sidebar-inner'] a, [data-slot='sidebar-inner'] button")].filter((e) => e.getBoundingClientRect().width > 0 && e.getAttribute("aria-label") !== "Toggle Sidebar") // the invisible drag-edge handle is not a control
            return els.map((e) => {
              const r = e.getBoundingClientRect()
              return { label: e.getAttribute("aria-label") ?? "", dx: +(r.left + r.width / 2 - axis).toFixed(2), w: Math.round(r.width), h: Math.round(r.height) }
            })
          })
          const bad = rail.filter((i) => Math.abs(i.dx) > 0.6)
          ok(`rail: all ${rail.length} controls on the same vertical axis  ${tag}`, bad.length === 0, JSON.stringify(bad.slice(0, 4)))
          const sizes = [...new Set(rail.map((i) => `${i.w}x${i.h}`))]
          ok(`rail: every control is a 44px square  ${tag}`, sizes.length === 1 && sizes[0] === "44x44", sizes.join(","))
        }
        if (shots) await page.screenshot({ path: `${out}/${name}-${w}x${h}-${collapsed ? "collapsed" : "expanded"}-${theme}.png` })
        await ctx.close()
      }
    }
  }
}

// Mobile.
for (const theme of ["dark", "light"]) {
  for (const [name, path] of [["inicio", "/dashboard"], ["tarefas", "/dashboard/tarefas"]]) {
    const { ctx, page } = await open({ width: 390, height: 844 }, theme, path, false)
    const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    ok(`mobile no horizontal scroll  ${name} ${theme}`, o <= 0)
    if (shots) await page.screenshot({ path: `${out}/${name}-390x844-${theme}.png` })
    await ctx.close()
  }
}

// Groups: open state follows the page, is remembered, and animates.
{
  const { ctx, page } = await open({ width: 1280, height: 800 }, "dark", "/dashboard/rotina", false)
  const trigger = (label) => page.getByRole("button", { name: label, exact: true })
  ok("group of the active page opens by itself (Vida on /rotina)", (await trigger("Vida").getAttribute("aria-expanded")) === "true" && (await trigger("Organização").getAttribute("aria-expanded")) === "false")
  const fits = await page.evaluate(() => { const n = document.querySelector("[data-slot='sidebar-inner'] nav"); return n.scrollHeight - n.clientHeight })
  ok("1280x800 with one group open: the list still fits", fits <= 0, `overflow=${fits}`)
  const t0 = Date.now()
  await trigger("Organização").click()
  await page.waitForTimeout(150)
  const mid = await page.evaluate(() => { const c = [...document.querySelectorAll("[data-slot='collapsible']")].find((g) => g.querySelector("[data-slot='collapsible-trigger']")?.textContent.trim() === "Organização")?.querySelector("[data-slot='collapsible-content']"); return c ? c.getBoundingClientRect().height : -1 })
  await page.waitForTimeout(600)
  const full = await page.evaluate(() => { const c = [...document.querySelectorAll("[data-slot='collapsible']")].find((g) => g.querySelector("[data-slot='collapsible-trigger']")?.textContent.trim() === "Organização")?.querySelector("[data-slot='collapsible-content']"); return c.getBoundingClientRect().height })
  ok("opening animates the height (mid < full)", mid > 0 && mid < full - 1, `mid=${Math.round(mid)} full=${Math.round(full)} elapsed=${Date.now() - t0}ms`)
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForTimeout(800)
  ok("state is remembered after a reload", (await trigger("Organização").getAttribute("aria-expanded")) === "true" && (await trigger("Vida").getAttribute("aria-expanded")) === "true")
  await page.screenshot({ path: `${out}/groups-open-1280x800-dark.png` })
  await ctx.close()
}

// Rail flyout + badges.
{
  const { ctx, page } = await open({ width: 1440, height: 900 }, "dark", "/dashboard", true)
  await page.getByRole("button", { name: "Organização", exact: true }).click()
  await page.waitForTimeout(500)
  ok("rail group opens a flyout with its items", (await page.getByRole("dialog").getByRole("link", { name: /Notas e lembretes|Cofre/ }).count()) >= 2)
  await page.screenshot({ path: `${out}/rail-flyout-1440x900-dark.png` })
  await page.keyboard.press("Escape")
  const badge = await page.evaluate(() => { const a = document.querySelector("[data-slot='sidebar-inner'] a[aria-label='Tarefas']"); const b = a?.querySelector("span.rounded-full"); return b ? { text: b.textContent, bg: getComputedStyle(b).backgroundColor } : null })
  ok("rail badge on Tarefas (round Lima, number)", badge?.text === "15", JSON.stringify(badge))
  await page.evaluate(() => document.activeElement?.blur()) // Esc returns focus to the flyout trigger, whose own tooltip would stay open
  await page.mouse.move(700, 500)
  await page.waitForTimeout(300)
  await page.locator("[data-slot='sidebar-inner'] a[aria-label='Tarefas']").hover()
  await page.waitForTimeout(1200)
  ok("rail tooltip shows the label", (await page.getByRole("tooltip").filter({ hasText: "Tarefas" }).count()) > 0)
  await ctx.close()
}

console.log(results.join("\n"))
await browser.close()
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
