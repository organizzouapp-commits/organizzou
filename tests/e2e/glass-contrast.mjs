// WCAG contrast of every visible text (and SVG chart label) on the glass app shell, measured from rendered pixels:
// the page is screenshotted with all text made transparent, then each element's box is sampled for the worst background.
//   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
//   node tests/e2e/glass-contrast.mjs      (BASE=http://localhost:3100)
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const MIN = 4.5
const browser = skipConsent(await chromium.launch(), base)
const results = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`)

const HIDE = "*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-decoration-color: transparent !important; caret-color: transparent !important } svg text, svg tspan { fill: transparent !important }"

async function audit(page) {
  // 1) elements with their own visible text (before hiding anything).
  const targets = await page.evaluate(() => {
    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
    const rgba = (css) => {
      probe.clearRect(0, 0, 1, 1)
      probe.fillStyle = css
      probe.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
      return [r, g, b, a / 255]
    }
    const list = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const seen = new Set()
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (!node.textContent.trim()) continue
      const el = node.parentElement
      if (!el || seen.has(el)) continue
      if (el.closest("script, style, noscript, [aria-hidden='true'], [data-nextjs-toast], nextjs-portal, #__next-build-watcher")) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const box = range.getBoundingClientRect()
      if (box.width < 2 || box.height < 2 || box.bottom < 0 || box.top > innerHeight || box.right < 0 || box.left > innerWidth) continue
      const s = getComputedStyle(el)
      if (s.visibility === "hidden" || s.display === "none") continue
      // Only what a person can actually see: the element must be topmost at its own position (not under a bar, not clipped).
      const topEl = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      const sameSvg = el instanceof SVGElement && topEl && topEl.closest("svg") === el.closest("svg")
      if (!topEl || !(el.contains(topEl) || sameSvg)) continue
      if (el.closest(".sr-only")) continue
      // Effective alpha: own color alpha x every ancestor's opacity.
      let opacity = 1
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity)
      if (opacity < 0.05) continue
      // Partly clipped by a scrolling/overflow ancestor (text cut at the scroll edge): not a readable sample, skip it.
      let visible = { l: box.left, t: box.top, r: box.right, b: box.bottom }
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const o = getComputedStyle(a)
        if (o.overflowX === "visible" && o.overflowY === "visible") continue
        const ar = a.getBoundingClientRect()
        visible = { l: Math.max(visible.l, ar.left), t: Math.max(visible.t, ar.top), r: Math.min(visible.r, ar.right), b: Math.min(visible.b, ar.bottom) }
      }
      const area = (r) => Math.max(0, r.r - r.l) * Math.max(0, r.b - r.t)
      if (area(visible) < area({ l: box.left, t: box.top, r: box.right, b: box.bottom }) * 0.9) continue
      const isSvg = el instanceof SVGElement
      const c = rgba(isSvg ? s.fill : s.color)
      seen.add(el)
      list.push({
        text: node.textContent.trim().slice(0, 40),
        cls: (el.getAttribute("class") || el.tagName).toString().slice(0, 60),
        color: [c[0], c[1], c[2], c[3] * opacity],
        box: { x: box.left, y: box.top, w: box.width, h: box.height },
        size: parseFloat(s.fontSize),
        weight: parseInt(s.fontWeight, 10) || 400,
      })
    }
    return list
  })

  // 2) background pixels with all text hidden.
  await page.addStyleTag({ content: HIDE })
  await page.waitForTimeout(150)
  const bg = (await page.screenshot()).toString("base64")

  return page.evaluate(
    async ({ bgB64, items }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${bgB64}`
      await img.decode()
      const dpr = img.width / innerWidth
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      const out = []
      for (const it of items) {
        const x = Math.max(0, Math.floor(it.box.x * dpr)), y = Math.max(0, Math.floor(it.box.y * dpr))
        const w = Math.max(1, Math.min(img.width - x, Math.floor(it.box.w * dpr))), h = Math.max(1, Math.min(img.height - y, Math.floor(it.box.h * dpr)))
        const data = ctx.getImageData(x, y, w, h).data
        const ratios = []
        const [tr, tg, tb, ta] = it.color
        for (let i = 0; i < data.length; i += 4 * 2) {
          const r = data[i], g = data[i + 1], b = data[i + 2]
          const br = tr * ta + r * (1 - ta), bgc = tg * ta + g * (1 - ta), bb = tb * ta + b * (1 - ta)
          const l1 = lum(br, bgc, bb), l2 = lum(r, g, b)
          ratios.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))
        }
        ratios.sort((a, b) => a - b)
        out.push({ ...it, ratio: Math.round(ratios[Math.floor(ratios.length * 0.05)] * 100) / 100 })
      }
      return out
    },
    { bgB64: bg, items: targets }
  )
}

for (const [w, h] of [[1440, 900], [390, 844]])
  for (const theme of ["dark", "light"])
    for (const path of ["/dashboard", "/dashboard/tarefas", "/dashboard/financas"]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768 })
      await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
      const page = await ctx.newPage()
      await page.goto(base + path, { waitUntil: "networkidle" })
      await page.addStyleTag({ content: "nextjs-portal { display: none !important } .fixed.z-40 { visibility: hidden !important }" })
      await page.waitForTimeout(1800)
      let items = await audit(page)
      if (w >= 1024) {
        // Second pass: the content scrolled down inside the frame, so charts and lower cards are covered too.
        await page.reload({ waitUntil: "networkidle" })
        await page.addStyleTag({ content: "nextjs-portal { display: none !important } .fixed.z-40 { visibility: hidden !important }" })
        await page.evaluate(() => document.querySelector("[data-app-scroll]")?.scrollBy(0, 520))
        await page.waitForTimeout(800)
        items = items.concat(await audit(page))
      }
      // WCAG: large text (>= 24px, or >= 18.66px and bold) needs 3:1, everything else 4.5:1.
      const need = (i) => (i.size >= 24 || (i.size >= 18.66 && i.weight >= 700) ? 3 : MIN)
      const failing = items.filter((i) => i.ratio < need(i))
      const worst = items.reduce((m, i) => (i.ratio < m.ratio ? i : m), { ratio: 99 })
      ok(`contrast >= ${MIN}  ${path} ${w}x${h} ${theme}`, failing.length === 0, `${items.length} texts, worst ${worst.ratio}:1 "${worst.text}"${failing.length ? "  FAILING: " + failing.slice(0, 6).map((f) => `"${f.text}" ${f.ratio}:1 (${f.cls})`).join(" | ") : ""}`)
      await ctx.close()
    }

console.log(results.join("\n"))
await browser.close()
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
