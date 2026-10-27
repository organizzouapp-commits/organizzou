// Google button (no toast on the happy path, spinner while redirecting), callback error handling, step-card hover.
//   node tests/e2e/auth-google-hover.mjs   (BASE=http://localhost:3100, OUT=./test-results/auth-fit)
import { mkdirSync } from "node:fs"
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const out = process.env.OUT ?? "test-results/auth-fit"
mkdirSync(out, { recursive: true })
const browser = skipConsent(await chromium.launch(), base)
const results = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`)
const TOAST = "Login com Google indisponível no momento. Use e-mail e senha."

// Google button: stop the navigation at the Supabase authorize URL so nothing leaves the machine.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  let target = null
  await page.route(/\/auth\/v1\/authorize|accounts\.google\.com/, (route) => {
    target = route.request().url()
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>stub</title>" })
  })
  await page.goto(`${base}/login`, { waitUntil: "networkidle" })
  await page.waitForTimeout(2500)
  const button = page.getByRole("button", { name: /Continuar com Google|Conectando/ })
  await button.click()
  await page.waitForTimeout(150)
  ok("button shows spinner + Conectando… and is disabled", (await button.textContent())?.includes("Conectando…") && (await button.isDisabled()))
  await page.waitForURL(/authorize|stub|google/, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1500)
  ok("navigated to the provider", Boolean(target), String(target).slice(0, 90))
  ok("no unavailable toast", (await page.getByText(TOAST).count()) === 0)
  await ctx.close()
}

// Callback.
for (const [path, expectOauth] of [
  ["/auth/callback?error=access_denied&error_description=denied", true],
  ["/auth/callback?provider=google&code=bad", true],
  ["/auth/callback?code=bad", false],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await page.goto(base + path, { waitUntil: "networkidle" })
  await page.waitForTimeout(2500)
  const url = new URL(page.url())
  const msg = await page.getByText("Não foi possível entrar com o Google. Tente de novo.").count()
  ok(`callback ${path}`, expectOauth ? url.pathname === "/login" && url.searchParams.get("error") === "oauth" && msg === 1 : url.searchParams.get("erro") === "link" && msg === 0, url.pathname + url.search)
  if (expectOauth && path.includes("access_denied")) await page.screenshot({ path: `${out}/oauth-error.png` })
  await ctx.close()
}

// Step cards.
for (const [w, h] of [[1280, 800], [1366, 768], [1440, 900]])
  for (const theme of ["dark", "light"])
    for (const route of ["entrar", "cadastro"]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } })
      await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
      const page = await ctx.newPage()
      await page.goto(`${base}/${route}`, { waitUntil: "networkidle" })
      await page.waitForTimeout(3000)
      const cards = page.locator("aside div[aria-hidden='false'] ol button")
      const tag = `${route} ${w}x${h} ${theme}`
      const clipped = await cards.evaluateAll((els) => els.filter((b) => b.scrollHeight > b.clientHeight + 1 || b.querySelector("span:last-child").getBoundingClientRect().bottom > b.getBoundingClientRect().bottom).length)
      ok(`step text not clipped  ${tag}`, clipped === 0)
      for (const i of [1, 2]) {
        await cards.nth(i).hover()
        await page.waitForTimeout(700)
        const s = await cards.nth(i).evaluate((b) => {
          const c = getComputedStyle(b), n = getComputedStyle(b.querySelector("span")), t = getComputedStyle(b.querySelector("span:last-child"))
          return { bg: c.backgroundColor, border: c.borderTopColor, bw: c.borderTopWidth, ty: c.translate !== "none" ? c.translate : c.transform, txt: t.color, nbg: n.backgroundColor, ncol: n.color, nbw: n.borderTopWidth }
        })
        const lima = (v) => /oklch\(0\.93|lab\(9[0-9]|rgb\(2(1|2)\d, 25\d, 0\)/.test(v) || v.startsWith("rgb(219, 253")
        ok(`hover card ${i + 1} is Lima, 2px borders  ${tag}`, lima(s.bg) && lima(s.border) && s.bw === "2px" && s.nbw === "2px", JSON.stringify(s))
        if (i === 1) await page.screenshot({ path: `${out}/hover-${route}-${w}x${h}-${theme}.png` })
      }
      await page.mouse.move(5, 5)
      await page.waitForTimeout(700)
      const back = await cards.nth(1).evaluate((b) => getComputedStyle(b).backgroundColor)
      ok(`card returns to glass  ${tag}`, !/219, 253|oklch\(0\.93/.test(back), back)
      await ctx.close()
    }

console.log(results.join("\n"))
await browser.close()
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
