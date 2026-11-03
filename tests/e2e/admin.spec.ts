/**
 * Admin area. The first block runs against the dev server with the login bypass (the `dev_admin` cookie plays the admin, and also
 * drives the proxy's 404 there):
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100 ; npx playwright test admin
 *
 * The last block needs a real project with the admin migrations applied, an admin account and a target account:
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... E2E_TARGET_EMAIL=... (and SUPABASE_SECRET_KEY set on the server)
 * Without them it is skipped: it cannot be faked.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const SIDEBAR_COOKIE = "sidebar_state_00000000000040008000000000000001"

const PAGES: { path: string; title: string }[] = [
  { path: "/admin", title: "Visão geral" },
  { path: "/admin/usuarios", title: "Usuários" },
  { path: "/admin/atividade", title: "Atividade" },
  { path: "/admin/assinaturas", title: "Assinaturas e pagamentos" },
  { path: "/admin/lista-de-espera", title: "Lista de espera" },
  { path: "/admin/planos", title: "Planos e limites" },
  { path: "/admin/modulos", title: "Uso dos módulos" },
  { path: "/admin/assistente", title: "Assistente e IA" },
  { path: "/admin/integracoes", title: "Integrações" },
  { path: "/admin/status", title: "Status" },
  { path: "/admin/suporte", title: "Suporte" },
  { path: "/admin/auditoria", title: "Auditoria" },
]

async function setup(context: BrowserContext, baseURL: string, { admin, sidebarOpen = true }: { admin: boolean; sidebarOpen?: boolean }) {
  await context.addCookies([
    { name: "organizzou_consent", value: CONSENT, url: baseURL },
    { name: SIDEBAR_COOKIE, value: String(sidebarOpen), url: baseURL },
    ...(admin ? [{ name: "dev_admin", value: "1", url: baseURL }] : []),
  ])
}

test.describe("access: non-admins", () => {
  for (const { path } of PAGES) {
    test(`${path} answers 404 (no redirect, no hint)`, async ({ page, context, baseURL }) => {
      await setup(context, baseURL!, { admin: false })
      const response = await page.goto(path)
      expect(response?.status()).toBe(404)
      expect(new URL(page.url()).pathname).toBe(path)
      await expect(page.getByText("Organizzou Admin")).toHaveCount(0)
      await expect(page.getByRole("link", { name: "Voltar ao app" })).toHaveCount(0)
    })
  }

  test("unknown admin sub-routes are 404 too", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, { admin: false })
    expect((await page.goto("/admin/qualquer-coisa"))?.status()).toBe(404)
  })
})

test.describe("admin sees every page", () => {
  for (const { path, title } of PAGES) {
    test(`${path} renders "${title}" inside the shared shell, without horizontal scroll`, async ({ page, context, baseURL }) => {
      await setup(context, baseURL!, { admin: true })
      await page.setViewportSize({ width: 1440, height: 900 })
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible({ timeout: 30000 })
      // Same shell as the app: the sidebar, with the Admin badge next to the logo.
      await expect(page.locator("[data-sidebar=sidebar] [data-slot=badge]").filter({ hasText: /^Admin$/ }).first()).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      expect(overflow).toBe(false)
    })
  }
})

test.describe("admin shell", () => {
  test("sidebar groups, footer link and header actions", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, { admin: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/admin")
    const sidebar = page.locator("[data-sidebar=sidebar]")
    await expect(sidebar.getByRole("link", { name: "Visão geral", exact: true })).toBeVisible({ timeout: 30000 })
    for (const name of ["Usuários", "Atividade"]) await expect(sidebar.getByRole("link", { name, exact: true })).toBeVisible()
    for (const group of ["Negócio", "Produto", "Sistema"]) await expect(sidebar.getByRole("button", { name: group })).toBeVisible()
    // The app's plan card and assistant do not exist here.
    await expect(page.getByText("Desbloqueie o Plano Pro")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /assistente/i })).toHaveCount(0)
    // Header actions: search and "Voltar ao app" (outline button), no "Novo" and no bell.
    await expect(page.getByRole("button", { name: "Buscar" }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: "Voltar ao app" }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Novo" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Notificações/ })).toHaveCount(0)
  })

  test("avatar menu offers Voltar ao app and Sair", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, { admin: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/admin")
    await page.getByRole("button", { name: "Menu da conta" }).click()
    await expect(page.getByRole("menuitem", { name: "Voltar ao app" })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "Sair" })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "Perfil" })).toHaveCount(0)
  })

  test("Ctrl K opens the admin palette and jumps to a page", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, { admin: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/admin")
    await expect(page.getByRole("heading", { level: 1, name: "Visão geral" })).toBeVisible({ timeout: 30000 })
    await page.keyboard.press("Control+k")
    await page.getByPlaceholder("Ir para…").fill("auditoria")
    await page.getByRole("option", { name: /Auditoria/ }).click()
    await expect(page).toHaveURL(/\/admin\/auditoria$/)
  })

  test("collapsed rail keeps the same destinations", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, { admin: true, sidebarOpen: false })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/admin")
    const rail = page.locator("[data-sidebar=sidebar]")
    await expect(rail.getByRole("link", { name: "Usuários" })).toBeVisible({ timeout: 30000 })
    for (const group of ["Negócio", "Produto", "Sistema"]) await expect(rail.getByRole("button", { name: group })).toBeVisible()
    await expect(rail.getByRole("link", { name: "Voltar ao app" })).toBeVisible()
  })

  test("phone: floating pill is Visão geral · Usuários · Pagamentos · Status · Mais, and Mais lists the rest", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, { admin: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/admin")
    const pill = page.getByRole("navigation", { name: "Navegação principal" })
    await expect(pill).toBeVisible({ timeout: 30000 })
    for (const name of ["Visão geral", "Usuários", "Pagamentos", "Status", "Mais"]) await expect(pill.getByRole("button", { name })).toBeVisible()
    await pill.getByRole("button", { name: "Mais" }).click()
    const sheet = page.getByRole("dialog")
    for (const name of ["Atividade", "Lista de espera", "Planos e limites", "Uso dos módulos", "Assistente e IA", "Integrações", "Suporte", "Auditoria"]) {
      await expect(sheet.getByRole("link", { name })).toBeVisible()
    }
    // Every touch target is at least 44 px tall.
    for (const link of await sheet.getByRole("link").all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  })

  test("the users page shows its filters and an honest empty/unavailable state, never fake rows", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, { admin: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/admin/usuarios")
    await expect(page.getByRole("search", { name: "Filtrar usuários" })).toBeVisible({ timeout: 30000 })
    // Exports are logged with the server key: without SUPABASE_SECRET_KEY the button is disabled and says why; with it, it is enabled.
    const exportButton = page.getByRole("button", { name: "Exportar CSV" })
    await expect(exportButton).toBeVisible()
    const hint = page.getByText("Configure a chave do servidor")
    if (await exportButton.isDisabled()) await expect(hint.first()).toBeVisible()
    else await expect(hint).toHaveCount(0)
  })
})

test.describe("the app shell is unchanged for regular users", () => {
  test("no Admin badge, no admin entry, same modules", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, { admin: false })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/dashboard")
    const sidebar = page.locator("[data-sidebar=sidebar]")
    await expect(sidebar.getByRole("link", { name: "Tarefas" })).toBeVisible({ timeout: 30000 })
    await expect(sidebar.locator("[data-slot=badge]").filter({ hasText: /^Admin$/ })).toHaveCount(0)
    for (const group of ["Vida", "Organização", "Configurações"]) await expect(sidebar.getByRole("button", { name: group })).toBeVisible()
    await page.getByRole("button", { name: "Menu da conta" }).click()
    await expect(page.getByRole("menuitem", { name: "Área do admin" })).toHaveCount(0)
    await expect(page.getByRole("menuitem", { name: "Perfil" })).toBeVisible()
  })

  test("admins get one extra entry, Área do admin, in the avatar menu", async ({ page, context, baseURL }) => {
    await setup(context, baseURL!, { admin: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/dashboard")
    await page.getByRole("button", { name: "Menu da conta" }).click()
    const entry = page.getByRole("menuitem", { name: "Área do admin" })
    await expect(entry).toBeVisible({ timeout: 30000 })
    await entry.click()
    await expect(page).toHaveURL(/\/admin$/)
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Needs a real project (run the server WITHOUT PROTOTYPE_BYPASS_AUTH): an admin changes a throwaway account's plan, the list and
// the audit log show it, and the person's own session sees it. It puts the account back to Gratuito at the end.
//   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD   an admin (app_metadata.role = 'admin')
//   E2E_TARGET_EMAIL / E2E_TARGET_PASSWORD a throwaway account that is NOT an admin
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const TARGET_EMAIL = process.env.E2E_TARGET_EMAIL
const TARGET_PASSWORD = process.env.E2E_TARGET_PASSWORD

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("E-mail").fill(email)
  await page.getByLabel("Senha").fill(password)
  await page.getByRole("button", { name: "Entrar" }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })
}

test.describe("change plan (real project)", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD || !TARGET_EMAIL || !TARGET_PASSWORD, "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_TARGET_EMAIL and E2E_TARGET_PASSWORD (and run the server WITHOUT PROTOTYPE_BYPASS_AUTH).")
  test.use({ viewport: { width: 1440, height: 900 } })

  async function changeTo(page: Page, plan: "Pro" | "Gratuito", toast: RegExp) {
    await page.goto(`/admin/usuarios?q=${encodeURIComponent(TARGET_EMAIL!)}`)
    await page.getByRole("link", { name: /Abrir/ }).first().click()
    await page.getByRole("button", { name: "Alterar plano" }).click()
    // Confirmation first: nothing is written until the dialog is confirmed.
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toBeVisible()
    await dialog.getByRole("combobox", { name: "Novo plano" }).click()
    await page.getByRole("option", { name: plan, exact: true }).click()
    await dialog.getByRole("button", { name: "Alterar plano" }).click()
    // The toast is the verified result (the action reads the row back); a failure would be a red "Não consegui alterar o plano. …".
    await expect(page.getByText(toast)).toBeVisible({ timeout: 30000 })
    await expect(page.getByText(/Não consegui alterar o plano/)).toHaveCount(0)
  }

  test("Pro: the list shows it, the audit log has the entry, the person's app drops 'Fazer upgrade'; then back to Gratuito", async ({ page, browser, baseURL }) => {
    await page.context().addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!)
    await changeTo(page, "Pro", /Plano Pro ativado/)

    // The users list and the detail panel show Pro right away (no reload by hand).
    await page.goto(`/admin/usuarios?q=${encodeURIComponent(TARGET_EMAIL!)}`)
    await expect(page.getByRole("row", { name: new RegExp(escapeRe(TARGET_EMAIL!)) }).getByText("Pro", { exact: true })).toBeVisible()

    await page.goto("/admin/auditoria")
    await expect(page.getByRole("row", { name: /Plano alterado/ }).first()).toBeVisible({ timeout: 30000 })

    // The person's own session reads the plan from the database on its next request.
    const person = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await person.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
    const app = await person.newPage()
    await signIn(app, TARGET_EMAIL!, TARGET_PASSWORD!)
    await expect(app.getByRole("link", { name: "Fazer upgrade" })).toHaveCount(0)

    await changeTo(page, "Gratuito", /Plano alterado para Gratuito/)
    await app.reload()
    await expect(app.getByRole("link", { name: "Fazer upgrade" }).first()).toBeVisible()
    await person.close()
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// The demo account is a test account: the user list always shows it with a "Teste" badge (the aggregate numbers leave it out), and an
// admin can change its plan like any other. Needs the migration 20261103000006 applied, an admin login and the demo session
// (E2E_DEMO_SESSION=1). It puts the account back to Gratuito at the end.
const DEMO_EMAIL = "organizzouapp@gmail.com"

test.describe("test accounts (real project)", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD || !process.env.E2E_DEMO_SESSION, "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD and E2E_DEMO_SESSION=1 (server WITHOUT PROTOTYPE_BYPASS_AUTH).")
  test.use({ viewport: { width: 1440, height: 900 } })

  async function changeDemoTo(page: Page, plan: "Pro" | "Gratuito", toast: RegExp) {
    await page.goto(`/admin/usuarios?q=${encodeURIComponent(DEMO_EMAIL)}`)
    await page.getByRole("link", { name: /Abrir/ }).first().click()
    await page.getByRole("button", { name: "Alterar plano" }).click()
    const dialog = page.getByRole("alertdialog")
    await dialog.getByRole("combobox", { name: "Novo plano" }).click()
    await page.getByRole("option", { name: plan, exact: true }).click()
    await dialog.getByRole("button", { name: "Alterar plano" }).click()
    await expect(page.getByText(toast)).toBeVisible({ timeout: 30000 })
  }

  test("listed with the Teste badge; Pro and back to Gratuito are audited and show at once in the account's app", async ({ page, browser, baseURL }) => {
    const { demoSessionCookies } = await import("./helpers/demo-session")
    await page.context().addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!)

    await page.goto(`/admin/usuarios?q=${encodeURIComponent(DEMO_EMAIL)}`)
    const row = page.getByRole("row", { name: new RegExp(escapeRe(DEMO_EMAIL)) }).or(page.getByRole("row", { name: /Teste/ })).first()
    await expect(row.getByText("Teste", { exact: true })).toBeVisible({ timeout: 30000 })

    const person = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await person.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }, ...(await demoSessionCookies(DEMO_EMAIL, baseURL!))])
    const app = await person.newPage()
    await app.goto("/dashboard")
    await expect(app.getByRole("link", { name: "Fazer upgrade" }).first()).toBeVisible({ timeout: 30000 })

    await changeDemoTo(page, "Pro", /Plano Pro ativado/)
    await page.goto("/admin/auditoria")
    await expect(page.getByRole("row", { name: /Plano alterado/ }).first()).toBeVisible({ timeout: 30000 })
    await app.reload()
    await expect(app.getByRole("link", { name: "Fazer upgrade" })).toHaveCount(0)

    await changeDemoTo(page, "Gratuito", /Plano alterado para Gratuito/)
    await app.reload()
    await expect(app.getByRole("link", { name: "Fazer upgrade" }).first()).toBeVisible()
    await person.close()
  })
})
