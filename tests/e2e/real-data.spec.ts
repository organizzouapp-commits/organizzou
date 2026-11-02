/**
 * Persistence against the REAL database: create something, reload, it is still there.
 *
 * Needs a real project with the data migrations applied and a test account that signs in with e-mail and password (run the server
 * WITHOUT PROTOTYPE_BYPASS_AUTH):
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD     the test account (organizzouapp@gmail.com, with a password set). It WRITES here: use only that account.
 *   E2E_CLEAN_EMAIL / E2E_CLEAN_PASSWORD   (optional) an account that must still be clean: it must show no demo data.
 *   npx playwright test real-data
 * Every row it creates has a unique name (`E2E <time>`), so reruns never collide. Without the variables the whole file is skipped.
 */
import { expect, test, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const EMAIL = process.env.E2E_USER_EMAIL
const PASSWORD = process.env.E2E_USER_PASSWORD
const CLEAN_EMAIL = process.env.E2E_CLEAN_EMAIL
const CLEAN_PASSWORD = process.env.E2E_CLEAN_PASSWORD
const stamp = `E2E ${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`

async function signIn(page: Page, email: string, password: string, baseURL: string) {
  await page.context().addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL }])
  await page.goto("/login")
  await page.getByLabel("E-mail").fill(email)
  await page.getByLabel("Senha").fill(password)
  await page.getByRole("button", { name: "Entrar" }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })
}

test.describe("real data persists across a reload", () => {
  test.skip(!EMAIL || !PASSWORD, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD (and run the server WITHOUT PROTOTYPE_BYPASS_AUTH).")
  test.use({ viewport: { width: 1440, height: 900 } })

  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, EMAIL!, PASSWORD!, baseURL!)
  })

  test("task from the quick capture", async ({ page }) => {
    const title = `${stamp} tarefa fazer`
    await page.getByRole("button", { name: "Novo", exact: true }).first().click()
    await page.getByLabel("O que você quer registrar?").fill(`fazer ${title}`)
    await page.getByRole("button", { name: "Salvar" }).click()
    await expect(page.getByText("Tarefa criada.")).toBeVisible({ timeout: 20000 })
    await page.goto("/dashboard/tarefas")
    await page.reload()
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 30000 })
  })

  test("habit: create, tick in Hoje, reload, untick", async ({ page }) => {
    const name = `${stamp} hábito`
    await page.goto("/dashboard/rotina")
    await page.getByRole("button", { name: "Novo hábito" }).first().click()
    await page.locator("#habit-name").fill(name)
    await page.getByRole("dialog").getByRole("button", { name: /Criar|Salvar/ }).click()
    await expect(page.getByText("Hábito criado.")).toBeVisible()
    await page.reload()
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 30000 })

    // Tick it in "Seu dia" and see it still ticked after a reload.
    await page.goto("/dashboard")
    const box = page.getByRole("checkbox", { name: `Concluir ${name}` })
    await expect(box).toBeVisible({ timeout: 60000 })
    await box.click()
    await expect(page.getByRole("checkbox", { name: `Reabrir ${name}` })).toBeVisible()
    await page.waitForTimeout(1500)
    await page.reload()
    const again = page.getByRole("checkbox", { name: `Reabrir ${name}` })
    await expect(again).toBeVisible({ timeout: 60000 })
    // Untick: also persists.
    await again.click()
    await expect(page.getByRole("checkbox", { name: `Concluir ${name}` })).toBeVisible()
    await page.waitForTimeout(1500)
    await page.reload()
    await expect(page.getByRole("checkbox", { name: `Concluir ${name}` })).toBeVisible({ timeout: 60000 })
  })

  test("transaction from the quick add in Finanças", async ({ page }) => {
    const what = `${stamp} mercado`
    await page.goto("/dashboard/financas")
    await page.getByLabel("Adicionar lançamento rápido").fill(`${what} 45,90`)
    await page.getByLabel("Adicionar lançamento rápido").press("Enter")
    await expect(page.getByText("Gasto registrado.")).toBeVisible()
    await page.reload()
    await expect(page.getByText(what, { exact: false }).first()).toBeVisible({ timeout: 30000 })
  })

  test("note: typing is saved after a pause and survives a reload", async ({ page }) => {
    const title = `${stamp} nota`
    await page.goto("/dashboard/notas")
    await page.getByRole("button", { name: "Nova nota" }).click()
    await page.getByLabel("Título da nota").fill(title)
    await page.waitForTimeout(2000) // the save waits ~0.8 s after the last keystroke
    await page.reload()
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 30000 })
  })

  test("life goal", async ({ page }) => {
    const title = `${stamp} meta`
    await page.goto("/dashboard/metas")
    await page.getByRole("button", { name: /Nova meta/ }).first().click()
    await page.locator("#goal-title").fill(title)
    await page.getByRole("dialog").getByRole("button", { name: /Criar|Salvar/ }).click()
    await page.reload()
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 30000 })
  })

  test("meal in Dieta", async ({ page }) => {
    await page.goto("/dashboard/dieta")
    await page.getByRole("button", { name: "Adicionar alimento" }).first().click()
    await page.getByPlaceholder("Buscar alimento").fill("Banana")
    await page.getByRole("option", { name: /Banana prata/ }).click()
    await page.getByRole("dialog").getByRole("button", { name: /Adicionar|Salvar/ }).last().click()
    await expect(page.getByText("Alimento adicionado.")).toBeVisible()
    await page.reload()
    await expect(page.getByText("Banana prata").first()).toBeVisible({ timeout: 30000 })
  })
})

test.describe("a clean account shows no demo data", () => {
  test.skip(!CLEAN_EMAIL || !CLEAN_PASSWORD, "Set E2E_CLEAN_EMAIL and E2E_CLEAN_PASSWORD to check an account that must stay clean.")
  test.use({ viewport: { width: 1440, height: 900 } })

  test("Hoje has no 100%, no invented numbers and the example names are nowhere", async ({ page, baseURL }) => {
    await signIn(page, CLEAN_EMAIL!, CLEAN_PASSWORD!, baseURL!)
    await page.goto("/dashboard")
    await expect(page.getByRole("heading", { name: "Seu dia" }).first()).toBeVisible({ timeout: 60000 })
    await expect(page.getByText("100%")).toHaveCount(0)
    for (const demo of ["Pagar IPTU", "Treino A", "Direito Constitucional", "Meditar 10 minutos", "Ata — alinhamento semanal", "Conta Nubank"]) {
      await expect(page.getByText(demo)).toHaveCount(0)
    }
    for (const path of ["rotina", "agenda", "financas", "treinos", "dieta", "estudos", "notas", "metas", "diario"]) {
      await page.goto(`/dashboard/${path}`)
      await expect(page.getByText(/Direito Constitucional|Treino A —|Conta Nubank|Marina|Smart Fit/)).toHaveCount(0)
    }
  })
})
