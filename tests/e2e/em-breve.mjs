// Coming-soon page: layout (no scroll on desktop, mobile image only), waitlist dialog (validation, success, duplicate), cleanup.
//   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
//   node tests/e2e/em-breve.mjs      (BASE=http://localhost:3100, OUT=./test-results/em-breve)
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local (used only to delete the test rows).
import { mkdirSync, readFileSync } from "node:fs"
import { chromium } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const out = process.env.OUT ?? "test-results/em-breve"
mkdirSync(out, { recursive: true })

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
)
// Without the service role key the submit/duplicate steps (which write to the database) are skipped.
const hasKey = Boolean(env.SUPABASE_SERVICE_ROLE_KEY)
const admin = hasKey ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null
const startedAt = new Date(Date.now() - 5000).toISOString()
const testEmail = `waitlist-test-${Date.now()}@example.com`

const browser = skipConsent(await chromium.launch(), base)
const results = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`)

async function open(viewport, theme, extra = {}) {
  const ctx = await browser.newContext({ viewport, ...extra })
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme)
  const page = await ctx.newPage()
  const images = []
  page.on("response", (r) => {
    if (r.url().includes("auth-background")) images.push(decodeURIComponent(r.url()))
  })
  await page.goto(`${base}/em-breve`, { waitUntil: "networkidle" })
  await page.waitForTimeout(2200)
  return { ctx, page, images }
}

// Layout.
for (const [w, h] of [[1440, 900], [1280, 800], [1366, 768]])
  for (const theme of ["dark", "light"]) {
    const { ctx, page } = await open({ width: w, height: h }, theme)
    const m = await page.evaluate(() => {
      const de = document.documentElement
      return { scroll: de.scrollHeight - de.clientHeight, hscroll: de.scrollWidth - de.clientWidth }
    })
    ok(`no scroll  ${w}x${h} ${theme}`, m.scroll <= 0 && m.hscroll <= 0, JSON.stringify(m))
    await page.screenshot({ path: `${out}/em-breve-${w}x${h}-${theme}.png` })
    await ctx.close()
  }

for (const theme of ["dark", "light"]) {
  const { ctx, page, images } = await open({ width: 390, height: 844 }, theme, { deviceScaleFactor: 2 })
  ok(`mobile loads only the mobile image  ${theme}`, images.length > 0 && images.every((u) => u.includes("auth-background-mobile")), images.map((u) => u.split("url=")[1]?.slice(0, 40)).join(","))
  const m = await page.evaluate(() => ({ hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, vscroll: document.documentElement.scrollHeight - innerHeight }))
  ok(`mobile no horizontal scroll  ${theme}`, m.hscroll <= 0, JSON.stringify(m))
  await page.screenshot({ path: `${out}/em-breve-390x844-${theme}.png` })
  if (theme === "dark") {
    await page.getByRole("button", { name: /Avise-me quando lançar/ }).click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/dialog-mobile-${theme}.png` })
    ok("mobile opens a bottom drawer", (await page.locator("[data-slot='drawer-content']").count()) === 1)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(700)
    ok("Esc closes the drawer", (await page.locator("[data-slot='drawer-content']").count()) === 0)
  }
  await ctx.close()
}

// Dialog on desktop.
for (const theme of ["dark", "light"]) {
  const { ctx, page } = await open({ width: 1440, height: 900 }, theme)
  const trigger = page.getByRole("button", { name: /Avise-me quando lançar/ })
  await trigger.click()
  await page.waitForTimeout(600)
  const dialog = page.getByRole("dialog")
  ok(`dialog opens  ${theme}`, await dialog.isVisible())
  ok(`background scroll locked  ${theme}`, await page.evaluate(() => getComputedStyle(document.body).overflow === "hidden" || document.body.hasAttribute("data-scroll-locked")))
  await page.screenshot({ path: `${out}/dialog-desktop-${theme}.png` })

  if (theme === "dark") {
    // Validation.
    await dialog.getByRole("button", { name: "Quero ser avisado" }).click()
    await page.waitForTimeout(500)
    const text = await dialog.innerText()
    ok("validation messages in pt-BR", ["Informe seu nome.", "Informe seu WhatsApp.", "Informe seu e-mail.", "Aceite para entrar na lista."].every((t) => text.includes(t)))
    await page.screenshot({ path: `${out}/dialog-errors-desktop-dark.png` })
    await dialog.getByLabel("E-mail").fill("nao-e-email")
    await dialog.getByLabel("WhatsApp").fill("123")
    await dialog.getByLabel("Nome").fill("Teste Playwright")
    await dialog.getByRole("button", { name: "Quero ser avisado" }).click()
    await page.waitForTimeout(400)
    const t2 = await dialog.innerText()
    ok("invalid e-mail / phone messages", t2.includes("Esse e-mail não parece válido.") && t2.includes("Informe um WhatsApp válido com DDD."))

    if (!hasKey) {
      results.push("SKIP  valid submit, duplicate e-mail (SUPABASE_SERVICE_ROLE_KEY is empty in .env.local)")
      await page.keyboard.press("Escape")
      await ctx.close()
      continue
    }
    // Valid submit.
    await dialog.getByLabel("E-mail").fill(testEmail)
    await dialog.getByLabel("WhatsApp").fill("11912345678")
    ok("phone mask", (await dialog.getByLabel("WhatsApp").inputValue()) === "(11) 91234-5678")
    await dialog.locator("#wl-consent").click()
    await dialog.getByRole("button", { name: "Quero ser avisado" }).click()
    await dialog.getByText("Pronto! Você está na lista.").waitFor({ timeout: 15000 }).then(() => ok("success state", true)).catch(() => ok("success state", false, "timeout"))
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${out}/dialog-success-desktop-dark.png` })
    const { data } = await admin.from("waitlist").select("name,phone,email,source,consent_at,user_agent").eq("email", testEmail)
    ok("row saved (E.164, source, consent)", data?.length === 1 && data[0].phone === "+5511912345678" && data[0].source === "em-breve" && Boolean(data[0].consent_at), JSON.stringify(data?.[0] ?? null).slice(0, 160))
    await dialog.getByRole("button", { name: "Fechar", exact: true }).first().click()
    await page.waitForTimeout(600)
    ok("Fechar closes the dialog", !(await dialog.isVisible().catch(() => false)))

    // Duplicate.
    await trigger.click()
    await page.waitForTimeout(500)
    await dialog.getByLabel("Nome").fill("Teste Playwright")
    await dialog.getByLabel("WhatsApp").fill("11912345678")
    await dialog.getByLabel("E-mail").fill(testEmail.toUpperCase())
    await dialog.locator("#wl-consent").click()
    await dialog.getByRole("button", { name: "Quero ser avisado" }).click()
    await dialog.getByText("Você já está na lista! 😉").waitFor({ timeout: 15000 }).then(() => ok("duplicate e-mail message", true)).catch(() => ok("duplicate e-mail message", false, "timeout"))
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${out}/dialog-duplicate-desktop-dark.png` })
    const { count } = await admin.from("waitlist").select("id", { count: "exact", head: true }).eq("email", testEmail)
    ok("duplicate did not create a second row", count === 1, String(count))
    await page.keyboard.press("Escape")
    await page.waitForTimeout(500)
    ok("Esc closes the dialog", !(await dialog.isVisible().catch(() => false)))
  } else {
    // Outside click closes.
    await page.mouse.click(10, 10)
    await page.waitForTimeout(600)
    ok("outside click closes the dialog", !(await dialog.isVisible().catch(() => false)))
  }
  await ctx.close()
}

// Cleanup: the test rows and the rate-limit bookkeeping created by this run.
if (hasKey) {
const del1 = await admin.from("waitlist").delete().eq("email", testEmail)
const del2 = await admin.from("waitlist_attempts").delete().gte("created_at", startedAt)
ok("test rows deleted", !del1.error && !del2.error, `${del1.error?.message ?? ""}${del2.error?.message ?? ""}`)
const { count: left } = await admin.from("waitlist").select("id", { count: "exact", head: true }).eq("email", testEmail)
ok("no test row left", left === 0)
}

console.log(results.join("\n"))
await browser.close()
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
