// Scroll performance of /dashboard: frame times while the content scrolls inside the frame, plus compositor/paint work from a
// Chrome trace. CPU is throttled so differences are visible on a fast machine. Numbers are only comparable run-to-run on the same machine.
//   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
//   LABEL=before node tests/e2e/perf-scroll.mjs      (writes test-results/perf-<LABEL>.json)
import { mkdirSync, writeFileSync } from "node:fs"
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const label = process.env.LABEL ?? "run"
const THROTTLE = Number(process.env.THROTTLE ?? 4)
mkdirSync("test-results", { recursive: true })
const browser = skipConsent(await chromium.launch(), base)
const out = {}

const ONLY = process.env.ONLY
for (const [name, viewport, theme] of [["desktop-dark", { width: 1440, height: 900 }, "dark"], ["desktop-light", { width: 1440, height: 900 }, "light"], ["mobile-dark", { width: 390, height: 844 }, "dark"]]) {
  if (ONLY && ONLY !== name) continue
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 768 })
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
  const page = await ctx.newPage()
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" })
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" + (process.env.INJECT ?? "") })
  await page.waitForTimeout(2500)

  const cdp = await ctx.newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE })
  await cdp.send("Performance.enable")
  await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "cc", "gpu"] })
  const m0 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]))

  const frames = await page.evaluate(async () => {
    const desktop = innerWidth >= 768
    const scroller = desktop ? document.querySelector("[data-app-scroll]") : document.scrollingElement
    const max = scroller.scrollHeight - (desktop ? scroller.clientHeight : innerHeight)
    const times = []
    let last = performance.now()
    const start = last
    const DURATION = 3000
    await new Promise((resolve) => {
      function step(now) {
        times.push(now - last)
        last = now
        const t = (now - start) / DURATION
        // down then back up, so the whole page is crossed twice
        const p = t < 0.5 ? t * 2 : 2 - t * 2
        scroller.scrollTop = Math.max(0, Math.min(max, p * max))
        if (now - start < DURATION) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
    return times.slice(1)
  })

  const traceBuf = await browser.stopTracing()
  const m1 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]))
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 })

  const sorted = [...frames].sort((a, b) => a - b)
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
  const avg = frames.reduce((a, b) => a + b, 0) / frames.length

  // Sum trace durations of the events that matter for scrolling.
  const events = JSON.parse(traceBuf.toString()).traceEvents ?? []
  const total = {}
  for (const e of events) {
    if (e.ph !== "X" || !e.dur) continue
    if (["Paint", "UpdateLayer", "RasterTask", "Layerize", "PrePaint", "CompositeLayers", "Commit", "UpdateLayoutTree", "Layout", "DrawFrame", "ImageDecodeTask", "GPUTask"].includes(e.name)) total[e.name] = (total[e.name] ?? 0) + e.dur / 1000
  }
  for (const k of Object.keys(total)) total[k] = Math.round(total[k])

  out[name] = {
    frames: frames.length,
    avgFrameMs: Math.round(avg * 10) / 10,
    p95FrameMs: Math.round(pct(0.95) * 10) / 10,
    maxFrameMs: Math.round(sorted[sorted.length - 1] * 10) / 10,
    slowFramesPct: Math.round((frames.filter((f) => f > 20).length / frames.length) * 100),
    veryslowFramesPct: Math.round((frames.filter((f) => f > 40).length / frames.length) * 100),
    cdpMs: {
      task: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000),
      layout: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000),
      recalcStyle: Math.round((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000),
      script: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000),
    },
    traceMs: total,
  }
  await ctx.close()
}

writeFileSync(`test-results/perf-${label}.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
await browser.close()
