// Recovery success state ("Confira seu e-mail") with the server action mocked, plus the Google-unavailable toast.
//   node tests/e2e/auth-recovery.mjs   (BASE=http://localhost:3100, OUT=./test-results/auth-fit)
import { mkdirSync } from "node:fs"
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const out = process.env.OUT ?? "test-results/auth-fit"
mkdirSync(out, { recursive: true })
const browser = skipConsent(await chromium.launch(), base)
const results = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`)

for (const [label, viewport] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 390, height: 844 }]])
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({ viewport })
    await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
    const page = await ctx.newPage()
    await page.route("**/recuperar-senha*", async (route) => {
      if (route.request().method() !== "POST") return route.continue()
      await route.fulfill({ status: 200, contentType: "text/x-component", body: '0:{"a":"$@1","f":"","b":"development"}\n1:{"ok":true}\n' })
    })
    await page.goto(`${base}/recuperar-senha`, { waitUntil: "networkidle" })
    await page.waitForTimeout(3000)
    await page.locator("#forgot-email").fill("organizzouapp@gmail.com")
    await page.getByRole("button", { name: "Enviar link" }).click()
    await page.getByRole("heading", { name: "Confira seu e-mail" }).waitFor({ timeout: 8000 })
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/recovery-sent-${label}-${theme}.png` })
    const info = await page.evaluate(() => ({
      href: [...document.querySelectorAll("a")].find((a) => a.textContent.includes("Abrir meu e-mail"))?.href,
      resend: [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Reenviar"))?.textContent,
      scroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }))
    ok(`sent state ${label} ${theme}`, info.href?.includes("mail.google.com") && /\(\d+s\)/.test(info.resend ?? ""), JSON.stringify(info))
    await ctx.close()
  }

{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await page.goto(`${base}/login`, { waitUntil: "networkidle" })
  await page.waitForTimeout(2500)
  await page.getByRole("button", { name: /Continuar com Google/ }).click()
  const toast = page.getByText("Login com Google indisponível no momento. Use e-mail e senha.")
  await toast.waitFor({ timeout: 10000 }).then(() => ok("google toast", true)).catch(() => ok("google toast", false, page.url()))
  ok("stayed on /login (no raw JSON)", page.url().includes("/login"), page.url())
  await page.screenshot({ path: `${out}/google-toast.png` })
  await ctx.close()
}
console.log(results.join("\n"))
await browser.close()
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
