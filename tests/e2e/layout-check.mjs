// Auth card spacing: the panel and the form area share the same top/bottom edges, and the card padding is P = 24px on all sides.
// Needs the prototype dev server:  node tests/e2e/layout-check.mjs
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"
const base = process.env.BASE ?? "http://localhost:3100"
const browser = skipConsent(await chromium.launch(), base)
const results = []
const ok = (n, p, extra = "") => results.push(`${p ? "PASS" : "FAIL"}  ${n}${extra ? "  " + extra : ""}`)
const near = (a, b, t = 1.5) => Math.abs(a - b) <= t

for (const [w, h] of [[1440, 900], [1280, 800]])
  for (const theme of ["dark", "light"])
    for (const route of ["entrar", "cadastro"]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } })
      await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
      const page = await ctx.newPage()
      await page.goto(`${base}/${route}`, { waitUntil: "networkidle" })
      await page.waitForTimeout(1000)
      const m = await page.evaluate((signup) => {
        const r = (el) => el.getBoundingClientRect()
        const panel = document.querySelector("aside[aria-label='Organizzou']").parentElement
        const card = panel.parentElement
        const panes = [...document.querySelectorAll("section[data-crossfade]")]
        const pane = panes[signup ? 0 : 1]
        const c = r(card), p = r(panel), f = r(pane)
        const cs = getComputedStyle(card)
        const steps = [...document.querySelectorAll("aside ol")].find((o) => o.offsetParent)
        const legal = pane.querySelector("nav[aria-label='Informações legais']")
        const toggle = pane.querySelector("button[aria-label^='Alternar']")
        const title = pane.querySelector("h1")
        return {
          card: { t: c.top, b: c.bottom, pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft] },
          panel: { l: p.left, r: p.right, t: p.top, b: p.bottom },
          pane: { l: f.left, r: f.right, t: f.top, b: f.bottom },
          stepsBottom: r(steps).bottom,
          legalBottom: r(legal).bottom,
          toggleBottom: r(toggle).bottom,
          titleTop: r(title).top,
          scrollW: document.documentElement.scrollWidth - innerWidth,
        }
      }, route === "cadastro")
      const tag = `${w}x${h} ${theme} /${route}`
      ok(`${tag}: card padding is 24px on all four sides`, m.card.pad.every((v) => v === "24px"))
      ok(`${tag}: panel and form area share top and bottom`, near(m.panel.t, m.pane.t) && near(m.panel.b, m.pane.b), `panel ${m.panel.t.toFixed(0)}-${m.panel.b.toFixed(0)} form ${m.pane.t.toFixed(0)}-${m.pane.b.toFixed(0)}`)
      ok(`${tag}: inset 24px from the card edges (+1px border)`, near(m.panel.t - m.card.t, 25, 2) && near(m.card.b - m.panel.b, 25, 2))
      const gap = route === "cadastro" ? m.panel.l - m.pane.r : m.pane.l - m.panel.r
      ok(`${tag}: 24px gap between panel and form area`, near(gap, 24), `gap ${gap.toFixed(1)}`)
      ok(`${tag}: legal links align with the bottom of the step cards`, near(m.legalBottom, m.stepsBottom, 12), `legal ${m.legalBottom.toFixed(0)} steps ${m.stepsBottom.toFixed(0)}`)
      ok(`${tag}: toggle does not overlap the title`, m.toggleBottom <= m.titleTop)
      ok(`${tag}: nothing overflows horizontally`, m.scrollW <= 1)
      await ctx.close()
    }
await browser.close()
console.log(results.join("\n"))
