/**
 * The "Seu dia" timeline on Hoje. Real session on the demo account (server WITHOUT the login bypass, demo loaded):
 *   E2E_DEMO_SESSION=1 npx playwright test seu-dia
 * Every change a test makes is undone in the test itself ("Desfazer"), and the demo can be reloaded with
 * `npm run seed:demo -- organizzouapp@gmail.com`.
 */
import { createClient } from "@supabase/supabase-js"
import { expect, test, type Page } from "@playwright/test"

import { demoSessionCookies, loadEnv } from "./helpers/demo-session"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const EMAIL = "organizzouapp@gmail.com"
const MARK = `sd${Date.now().toString(36)}`

test.skip(!process.env.E2E_DEMO_SESSION, "needs E2E_DEMO_SESSION=1 and the real-auth server")
test.describe.configure({ mode: "serial" })
test.use({ viewport: { width: 1440, height: 1000 } })

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }, ...(await demoSessionCookies(EMAIL, baseURL!))])
})

async function open(page: Page) {
  await page.goto("/dashboard")
  await expect(page.locator('[data-testid="seu-dia-list"]:visible').first()).toBeVisible({ timeout: 60000 })
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
}
const card = (page: Page) => page.locator('section[aria-label="Seu dia"]:visible').first()
const group = (page: Page, id: string) => card(page).locator(`[data-group="${id}"]`)

test("header: date, 'N de M feitos', overdue count, and the new chips and groups", async ({ page }) => {
  await open(page)
  await expect(card(page).getByRole("heading", { name: "Seu dia" })).toBeVisible()
  await expect(card(page).getByText(/^(Segunda|Terça|Quarta|Quinta|Sexta|Sábado|Domingo), \d{1,2} de \w+/)).toBeVisible()
  await expect(card(page).getByTestId("seu-dia-summary")).toContainText(/\d+ de \d+ feitos/)
  await expect(card(page).getByRole("link", { name: /^Agenda/ })).toBeVisible()
  // Chips count only what is pending, and none shows a zero.
  const chips = await card(page).getByRole("group", { name: "Filtrar o dia" }).getByRole("button").allInnerTexts()
  expect(chips.length).toBeGreaterThan(1)
  for (const chip of chips) expect(chip).not.toMatch(/\s0$/)
  // One count per group header: no "N pendentes" text next to the pill.
  await expect(card(page).getByText(/\d+ pendentes?/)).toHaveCount(0)
})

test("completing a task shows the toast, strikes the title, and Desfazer brings it back (saved after a reload)", async ({ page }) => {
  await open(page)
  const title = "Responder e-mails pendentes"
  const box = card(page).getByRole("checkbox", { name: `Concluir: ${title}` })
  await box.click()
  await expect(page.getByText("Tarefa concluída")).toBeVisible()
  await expect(card(page).locator(`[data-row] [data-done]`).filter({ hasText: title }).first()).toBeVisible()
  await page.getByRole("button", { name: "Desfazer" }).click()
  await expect(card(page).getByRole("checkbox", { name: `Concluir: ${title}` })).toBeVisible()
  await page.waitForTimeout(2000) // let the saves finish: a reload would cancel one still in flight
  await page.reload()
  await expect(card(page).getByRole("checkbox", { name: `Concluir: ${title}` })).toBeVisible({ timeout: 30000 })
})

test("'Reagendar tudo para amanhã' moves the overdue tasks, and Desfazer puts them back", async ({ page }) => {
  await open(page)
  const overdue = group(page, "atrasados")
  await expect(overdue).toBeVisible()
  const before = await overdue.getByRole("checkbox").count()
  await overdue.getByRole("button", { name: "Reagendar tudo para amanhã" }).click()
  await expect(page.getByText(/tarefas? reagendadas? para amanhã/)).toBeVisible()
  await expect.poll(() => overdue.getByRole("checkbox", { name: /^Concluir/ }).count()).toBeLessThan(before)
  await page.getByRole("button", { name: "Desfazer" }).click()
  await expect.poll(() => overdue.getByRole("checkbox").count()).toBe(before)
  await page.waitForTimeout(3000)
  await page.reload()
  await expect(group(page, "atrasados").getByRole("checkbox")).toHaveCount(before, { timeout: 30000 })
})

test("a collapsed group stays collapsed after a reload", async ({ page }) => {
  await open(page)
  const toggle = group(page, "habitos").getByRole("button", { name: /Hábitos/ })
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click()
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await page.waitForTimeout(800)
  await page.reload()
  await expect(page.locator('[data-testid="seu-dia-list"]:visible').first()).toBeVisible({ timeout: 60000 })
  await expect(group(page, "habitos").getByRole("button", { name: /Hábitos/ })).toHaveAttribute("aria-expanded", "false")
  await group(page, "habitos").getByRole("button", { name: /Hábitos/ }).click()
  await page.waitForTimeout(800)
  await page.reload()
  await expect(group(page, "habitos").getByRole("button", { name: /Hábitos/ })).toHaveAttribute("aria-expanded", "true", { timeout: 30000 })
})

test("the 'agora' divider sits between what already started and what is still to come", async ({ page }) => {
  await open(page)
  const hoje = group(page, "hoje")
  const divider = hoje.locator("[data-now]")
  await expect(divider).toBeVisible()
  const nowText = (await divider.innerText()).trim()
  expect(nowText).toMatch(/^\d{2}:\d{2}$/)
  // Every timed row, in page order, with its time and whether it is the current one.
  const rows = await hoje.evaluate((el) => {
    const out: { kind: "row" | "divider"; time: string; current: boolean }[] = []
    el.querySelectorAll("[data-row], [data-now]").forEach((node) => {
      if ((node as HTMLElement).hasAttribute("data-now")) return void out.push({ kind: "divider", time: "", current: false })
      const time = node.querySelector<HTMLElement>("span.tabular.hidden")?.firstElementChild?.textContent?.trim() ?? ""
      out.push({ kind: "row", time, current: node.querySelector("[data-current]") !== null })
    })
    return out
  })
  const at = rows.findIndex((r) => r.kind === "divider")
  for (const r of rows.slice(0, at)) if (/^\d{2}:\d{2}$/.test(r.time)) expect(r.time <= nowText, `${r.time} is before the divider (${nowText})`).toBe(true)
  for (const r of rows.slice(at + 1)) if (/^\d{2}:\d{2}$/.test(r.time) && !r.current) expect(r.time >= nowText, `${r.time} is after the divider (${nowText})`).toBe(true)
})

test("a quantity habit takes + and − (and goes back)", async ({ page }) => {
  await open(page)
  const chip = group(page, "habitos").locator("[data-habit-qty]").first()
  await expect(chip).toBeVisible()
  const read = async () => (await chip.locator(".tabular").first().innerText()).trim()
  const before = await read()
  const add = chip.getByRole("button", { name: /^Adicionar / })
  const remove = chip.getByRole("button", { name: /^Remover / })
  if (await add.isDisabled()) {
    await remove.click()
    await expect.poll(read).not.toBe(before)
    await add.click()
  } else {
    await add.click()
    await expect.poll(read).not.toBe(before)
    await expect(remove).toBeEnabled()
    await remove.click()
  }
  await expect.poll(read).toBe(before)
})

test("quick add creates a task due today from the text", async ({ page }) => {
  await open(page)
  const input = card(page).getByRole("textbox", { name: "Adicionar ao dia" })
  await expect(input).toHaveAttribute("placeholder", /Adicionar ao dia/)
  await input.fill(`ligar para o banco ${MARK} às 23h`)
  await input.press("Enter")
  await expect(page.getByText(new RegExp(`Tarefa criada: Ligar para o banco ${MARK}`))).toBeVisible({ timeout: 20000 })
  await page.reload()
  await expect(page.getByText(`Ligar para o banco ${MARK}`).first()).toBeVisible({ timeout: 30000 })
})

for (const theme of ["dark", "light"] as const) {
  test(`no horizontal scroll and no clipped controls at 360, 390, 768, 1024, 1280 and 1440 (${theme})`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme)
    for (const width of [360, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await open(page)
      await page.waitForTimeout(400)
      const problems = await page.evaluate(() => {
        const out: string[] = []
        if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push("page scrolls sideways")
        const root = [...document.querySelectorAll<HTMLElement>('section[aria-label="Seu dia"]')].find((el) => el.offsetParent !== null)!
        const box = root.getBoundingClientRect()
        root.querySelectorAll("button, a, input, [role=checkbox]").forEach((el) => {
          const r = (el as HTMLElement).getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return
          // Controls that scroll sideways on purpose (the chips row) are allowed to leave the card.
          if ((el as HTMLElement).closest("[role=group][aria-label='Filtrar o dia']")) return
          if (r.right > box.right + 1 || r.left < box.left - 1) out.push(`${el.getAttribute("aria-label") ?? el.textContent?.slice(0, 20)} leaves the card`)
        })
        return out
      })
      expect(problems, `${theme} ${width}px`).toEqual([])
    }
  })
}

test.afterAll(async () => {
  const { url, secret } = loadEnv()
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  await db.from("tasks").delete().ilike("title", `%${MARK}%`)
  await db.from("audit_log").delete().ilike("payload->>label", `%${MARK}%`)
})
