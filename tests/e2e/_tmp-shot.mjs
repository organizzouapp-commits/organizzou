import { chromium } from "@playwright/test"
const D = "C:/Users/Patrick/AppData/Local/Temp/claude/c--Users-Patrick-Desktop-Pessoal-organizzou/6d05e4f0-bdda-4e72-af17-004f088c6e04/scratchpad/"
const [, , name, path, w, h, theme = "dark"] = process.argv
const b = await chromium.launch()
const consent = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const ctx = await b.newContext({ viewport: { width: +w, height: +h } })
await ctx.addCookies([{ name: "organizzou_consent", value: consent, url: "http://localhost:3100" }])
await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
const p = await ctx.newPage()
p.on("pageerror", (e) => console.log("PAGEERR", String(e).slice(0, 200)))
await p.goto("http://localhost:3100" + path, { waitUntil: "load", timeout: 60000 })
await p.waitForTimeout(1500)
await p.screenshot({ path: D + name + ".png", fullPage: process.argv[7] === "full" })
await b.close()
