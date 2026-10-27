// Sidebar WhatsApp CTA: never cut. Full card >= 1150px tall, one-line pill 901-1149px, hidden <= 900px, icon + tooltip when collapsed.
//   node tests/e2e/wa-cta.mjs   (BASE=http://localhost:3100, OUT=./test-results/glass)
import { mkdirSync } from "node:fs"
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const out = process.env.OUT ?? "test-results/glass"
mkdirSync(out, { recursive: true })
const browser = skipConsent(await chromium.launch(), base)
const results = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`)

async function sidebarState(page) {
  return page.evaluate(() => {
    const inner = document.querySelector("[data-slot='sidebar-inner']").getBoundingClientRect()
    const vis = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      if (s.display === "none" || r.width === 0 || r.height === 0) return null
      return { top: r.top, bottom: r.bottom, inside: r.top >= inner.top - 1 && r.bottom <= inner.bottom + 1 }
    }
    const links = [...document.querySelectorAll("[data-slot='sidebar-inner'] a")].filter((a) => a.href.includes("aba=whatsapp"))
    const shown = links.map((a) => ({ text: a.textContent.trim(), label: a.getAttribute("aria-label"), ...vis(a) })).filter((x) => x.top !== undefined)
    const card = [...document.querySelectorAll("[data-slot='sidebar-inner'] p")].find((p) => p.textContent.includes("Fale com o assistente"))
    return { shown, hasCardText: Boolean(card && vis(card)), cardInside: card ? vis(card)?.inside : null }
  })
}

for (const [w, h, collapsed, expect] of [[1440, 900, false, "hidden"], [1440, 1000, false, "compact"], [1847, 1007, false, "compact"], [1920, 1200, false, "full"], [1440, 1000, true, "icon"], [1440, 900, true, "hidden"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } })
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), "dark")
  const page = await ctx.newPage()
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" })
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" })
  if (collapsed) {
    await page.getByRole("button", { name: "Recolher menu" }).click()
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(800)
  const s = await sidebarState(page)
  const tag = `${w}x${h}${collapsed ? " collapsed" : ""}`
  if (expect === "hidden") ok(`CTA hidden (no sliver)  ${tag}`, s.shown.length === 0)
  if (expect === "compact") ok(`compact pill, fully inside the sidebar  ${tag}`, s.shown.length === 1 && s.shown[0].text === "Conecte seu WhatsApp" && s.shown[0].inside && !s.hasCardText, JSON.stringify(s.shown))
  if (expect === "full") {
    const btn = await page.getByRole("link", { name: "Conectar", exact: true }).first().boundingBox()
    ok(`full card: title, text and button inside the sidebar  ${tag}`, s.hasCardText && s.cardInside && Boolean(btn), JSON.stringify(s))
  }
  if (expect === "icon") {
    const link = page.getByRole("link", { name: "Conecte seu WhatsApp" })
    ok(`collapsed: icon only  ${tag}`, s.shown.length === 1 && s.shown[0].text === "" && s.shown[0].inside)
    await link.hover()
    await page.waitForTimeout(600)
    ok(`collapsed: tooltip shows the label  ${tag}`, (await page.getByRole("tooltip").filter({ hasText: "Conecte seu WhatsApp" }).count()) > 0)
  }
  await page.screenshot({ path: `${out}/wa-cta-${w}x${h}${collapsed ? "-collapsed" : ""}.png`, clip: { x: 0, y: Math.max(0, h - 420), width: 360, height: 420 } })
  await ctx.close()
}
console.log(results.join("\n"))
await browser.close()
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
