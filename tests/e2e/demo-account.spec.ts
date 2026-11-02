/**
 * Two promises about data:
 *
 * 1. A clean account (any new account, and Patrick's) shows every module in its empty state: no sample items, no invented numbers, no
 *    100%, and a way to start. This runs against the dev server with the login bypass: it has no session, so it sees exactly what a
 *    brand-new account sees (no rows). No credentials needed.
 *      PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test demo-account
 *
 * 2. On the DEMO account the things you do in "Hoje" are kept: mark a task done, a fixed habit and a quantity habit, reload, and they are
 *    still done. Needs the real project with the migrations applied, the demo loaded (npm run seed:demo -- organizzouapp@gmail.com), the
 *    server WITHOUT the bypass, and the demo account signed in with e-mail and password:
 *      E2E_DEMO_EMAIL=organizzouapp@gmail.com E2E_DEMO_PASSWORD=... npx playwright test demo-account
 *    It changes only demo rows; run \`npm run seed:demo -- organizzouapp@gmail.com\` again to put the demo back the way it was.
 */
import { expect, test, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const SIDEBAR_COOKIE = "sidebar_state_00000000000040008000000000000001"
const DEMO_NAMES = /Enviar relatório semanal à Marina|Consulta com a Dra\. Camila|Conta Nubank|Direito Constitucional|Treino A — Peito|Beber 2,5 litros|Pagar IPTU|Smart Fit|Sapiens/

async function settle(page: Page) {
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 30000 })
}

test.describe("a clean account: every module shows its empty state", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  const modules: { path: string; empty: RegExp | string; action?: string; tab?: string }[] = [
    { path: "", empty: "Nada marcado para hoje", action: "Adicionar tarefa" },
    { path: "/tarefas", empty: "Nenhum quadro ainda", action: "Criar quadro" },
    { path: "/rotina", empty: "Nenhum hábito ainda", action: "Criar o primeiro hábito" },
    { path: "/agenda", empty: "Nada marcado para este dia." },
    { path: "/financas", empty: "Para onde o dinheiro vai, sem planilha." },
    { path: "/treinos", empty: "Nenhum treino previsto para hoje." },
    { path: "/dieta", empty: "kcal restam" },
    { path: "/estudos", empty: "Nenhuma matéria ainda", action: "Criar a primeira matéria", tab: "Matérias" },
    { path: "/notas", empty: "Nenhuma nota" },
    { path: "/metas", empty: "Nenhuma meta ainda", action: "Criar a primeira meta" },
    { path: "/diario", empty: "Como foi hoje?" },
    { path: "/cofre", empty: "O Cofre ainda não está disponível" },
  ]

  for (const { path, empty, action, tab } of modules) {
    test(`/dashboard${path || ""}`, async ({ page, context, baseURL }) => {
      await context.addCookies([
        { name: "organizzou_consent", value: CONSENT, url: baseURL! },
        { name: SIDEBAR_COOKIE, value: "true", url: baseURL! },
      ])
      await page.goto(`/dashboard${path}`)
      if (tab) await page.getByRole("tab", { name: tab }).click({ timeout: 60000 })
      await expect(page.getByText(empty).locator("visible=true").first()).toBeVisible({ timeout: 60000 })
      await settle(page)
      if (action) await expect(page.getByRole("button", { name: action })).toBeVisible()
      const text = await page.locator("body").innerText()
      expect(text, "sample content").not.toMatch(DEMO_NAMES)
      expect(text, "an invented 100%").not.toMatch(/\b100\s?%/)
    })
  }

  test("Hoje: zero of everything, never a full bar", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
    await page.goto("/dashboard")
    await expect(page.getByText("Nada marcado para hoje")).toBeVisible({ timeout: 60000 })
    await settle(page)
    // Every number is a zero or a dash, and no progress bar is full.
    for (const bar of await page.getByRole("progressbar").all()) {
      const value = await bar.getAttribute("aria-valuenow")
      if (value !== null) expect(Number(value)).toBeLessThan(100)
    }
  })
})

test.describe("the demo account keeps what you do in Hoje", () => {
  const EMAIL = process.env.E2E_DEMO_EMAIL
  const PASSWORD = process.env.E2E_DEMO_PASSWORD
  test.skip(!EMAIL || !PASSWORD, "Set E2E_DEMO_EMAIL and E2E_DEMO_PASSWORD (and run the server WITHOUT PROTOTYPE_BYPASS_AUTH, with the demo loaded).")
  test.use({ viewport: { width: 1440, height: 900 } })

  async function openHoje(page: Page) {
    await page.goto("/dashboard")
    await expect(page.getByTestId("seu-dia-list")).toBeVisible({ timeout: 60000 })
    await settle(page)
    // Open every folded group, so each row can be reached.
    for (const header of await page.getByTestId("seu-dia-list").getByRole("button", { expanded: false }).all()) await header.click()
  }

  test.beforeEach(async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
    await page.goto("/login")
    await page.getByLabel("E-mail").fill(EMAIL!)
    await page.getByLabel("Senha").fill(PASSWORD!)
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })
  })

  test("a task marked done is still done after a reload (and can be reopened)", async ({ page }) => {
    const title = "Enviar relatório semanal à Marina"
    await openHoje(page)
    const open = page.getByRole("checkbox", { name: `Concluir ${title}` })
    const reopen = page.getByRole("checkbox", { name: `Reabrir ${title}` })
    if (await reopen.count()) await reopen.click() // a previous run left it done: start from "open"
    await expect(open).toBeVisible()
    await open.click()
    await expect(reopen).toBeVisible()
    await page.waitForTimeout(1500)
    await page.reload()
    await openHoje(page)
    await expect(page.getByRole("checkbox", { name: `Reabrir ${title}` })).toBeVisible({ timeout: 30000 })
    // Back to open, and that is kept too.
    await page.getByRole("checkbox", { name: `Reabrir ${title}` }).click()
    await expect(page.getByRole("checkbox", { name: `Concluir ${title}` })).toBeVisible()
    await page.waitForTimeout(1500)
    await page.reload()
    await openHoje(page)
    await expect(page.getByRole("checkbox", { name: `Concluir ${title}` })).toBeVisible({ timeout: 30000 })
  })

  test("a fixed habit checked or unchecked stays that way after a reload", async ({ page }) => {
    const name = "Meditar 10 minutos"
    await openHoje(page)
    const done = page.getByRole("checkbox", { name: `Reabrir ${name}` })
    const todo = page.getByRole("checkbox", { name: `Concluir ${name}` })
    const wasDone = (await done.count()) > 0
    await (wasDone ? done : todo).click()
    await expect(wasDone ? todo : done).toBeVisible()
    await page.waitForTimeout(1500)
    await page.reload()
    await openHoje(page)
    await expect(wasDone ? page.getByRole("checkbox", { name: `Concluir ${name}` }) : page.getByRole("checkbox", { name: `Reabrir ${name}` })).toBeVisible({ timeout: 30000 })
    // Put it back.
    await (wasDone ? page.getByRole("checkbox", { name: `Concluir ${name}` }) : page.getByRole("checkbox", { name: `Reabrir ${name}` })).click()
    await page.waitForTimeout(1500)
  })

  test("a quantity habit keeps the amount added after a reload", async ({ page }) => {
    const name = "Beber 2,5 litros de água"
    await openHoje(page)
    const row = page.getByTestId("seu-dia-list").locator('[data-kind="habit"]', { hasText: name })
    const amount = async () => (await row.getByText(/de 2,5 L/).first().innerText()).trim()
    const before = await amount()
    await row.getByRole("button", { name: new RegExp(`^Adicionar .* a ${name}$`) }).click()
    await expect.poll(amount).not.toBe(before)
    const after = await amount()
    await page.waitForTimeout(1500)
    await page.reload()
    await openHoje(page)
    await expect(page.getByTestId("seu-dia-list").locator('[data-kind="habit"]', { hasText: name }).getByText(after, { exact: false }).first()).toBeVisible({ timeout: 30000 })
  })
})
