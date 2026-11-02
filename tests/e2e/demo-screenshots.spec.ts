/**
 * Screenshots of EVERY screen and sub-tab of the demo account, at 1440x900 (dark, and light for the main screens) and 390x844 (dark),
 * saved to docs/demo-screenshots/. They are the proof for docs/DEMO-COVERAGE.md: an element counts as covered only if it shows here.
 *
 * Needs the real project (migrations applied, demo loaded: npm run seed:demo -- organizzouapp@gmail.com) and the server WITHOUT the login bypass:
 *   NEXT_DIST_DIR=.next-shots npx next dev -p 3100        (no PROTOTYPE_BYPASS_AUTH)
 *   E2E_DEMO_SCREENSHOTS=1 npx playwright test demo-screenshots
 * The session comes from a one-time magic-link token made with the secret key in .env.local (see helpers/demo-session.ts).
 */
import { mkdirSync } from "node:fs"
import { join } from "node:path"

import { expect, test, type Page } from "@playwright/test"

import { boardIds, demoSessionCookies } from "./helpers/demo-session"

const EMAIL = "organizzouapp@gmail.com"
const OUT = join("docs", "demo-screenshots")
const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

type Screen = {
  slug: string
  path: string | ((boards: Record<string, string>) => string)
  /** Also shoot every tab of the first tab list on the page. */
  tabs?: boolean
  /** Also shoot in light mode on the desktop. */
  light?: boolean
  /** Extra captures on the same page: [name, action that puts the page in that state]. */
  extra?: [string, (page: Page) => Promise<void>][]
}

const openFirstNote = async (page: Page) => {
  await page.getByRole("tab", { name: "Notas" }).click()
  await page.getByRole("button", { name: /Ata — alinhamento semanal/ }).first().click()
}

const SCREENS: Screen[] = [
  {
    slug: "hoje",
    path: "/dashboard",
    light: true,
    extra: [
      ["bell", async (page) => void (await page.getByRole("button", { name: /^Notificações/ }).first().click())],
      ["personalizar", async (page) => void (await page.getByRole("button", { name: "Personalizar" }).click())],
      ["painel-financas-aberto", async (page) => void (await page.locator('[data-panel="financas"] button[aria-controls]').click())],
    ],
  },
  { slug: "tarefas-kanban-trabalho", path: (b) => `/dashboard/tarefas/${b["Trabalho"]}`, light: true },
  { slug: "tarefas-lista-trabalho", path: (b) => `/dashboard/tarefas/${b["Trabalho"]}?visao=lista` },
  { slug: "tarefas-calendario-trabalho", path: (b) => `/dashboard/tarefas/${b["Trabalho"]}?visao=calendario` },
  { slug: "tarefas-quatro-listas", path: (b) => `/dashboard/tarefas/${b["Lançamento do app"]}` },
  {
    slug: "tarefas-detalhe",
    path: (b) => `/dashboard/tarefas/${b["Trabalho"]}`,
    extra: [["detalhe-relatorio", async (page) => void (await page.getByText("Enviar relatório semanal à Marina").first().click())]],
  },
  { slug: "agenda", path: "/dashboard/agenda", tabs: true, light: true },
  { slug: "rotina", path: "/dashboard/rotina", tabs: true },
  { slug: "financas", path: "/dashboard/financas", tabs: true, light: true },
  { slug: "treinos", path: "/dashboard/treinos", tabs: true },
  { slug: "dieta", path: "/dashboard/dieta", tabs: true },
  { slug: "estudos", path: "/dashboard/estudos", tabs: true },
  { slug: "notas", path: "/dashboard/notas", tabs: true, extra: [["nota-aberta", openFirstNote]] },
  { slug: "metas", path: "/dashboard/metas" },
  { slug: "diario", path: "/dashboard/diario" },
  { slug: "cofre", path: "/dashboard/cofre" },
  { slug: "plano", path: "/dashboard/plano" },
  { slug: "ajuda", path: "/dashboard/ajuda" },
  { slug: "perfil", path: "/dashboard/perfil" },
  { slug: "configuracoes", path: "/dashboard/configuracoes", tabs: true },
  { slug: "admin-visao-geral", path: "/admin" },
  { slug: "admin-usuarios", path: "/admin/usuarios" },
  { slug: "admin-atividade", path: "/admin/atividade" },
  { slug: "admin-modulos", path: "/admin/modulos" },
  { slug: "admin-planos", path: "/admin/planos" },
  { slug: "admin-assinaturas", path: "/admin/assinaturas" },
  { slug: "admin-lista-de-espera", path: "/admin/lista-de-espera" },
  { slug: "admin-assistente", path: "/admin/assistente" },
  { slug: "admin-integracoes", path: "/admin/integracoes" },
  { slug: "admin-status", path: "/admin/status" },
  { slug: "admin-auditoria", path: "/admin/auditoria" },
  { slug: "admin-suporte", path: "/admin/suporte" },
]

async function settle(page: Page) {
  await page.waitForFunction(() => document.querySelectorAll('[hidden][id^="S:"]').length === 0, undefined, { timeout: 45000 }).catch(() => undefined)
  await page.waitForTimeout(900)
}

/** The desktop frame scrolls inside itself, so the window is made as tall as the content; the phone scrolls the page (full-page shot). */
async function shoot(page: Page, file: string, phone: boolean) {
  if (phone) {
    await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 62 })
    return
  }
  const height = await page.evaluate(() => (document.querySelector("[data-app-scroll]")?.scrollHeight ?? 700) + 190)
  await page.setViewportSize({ width: 1440, height: Math.min(Math.max(height, 900), 3400) })
  await page.waitForTimeout(300)
  await page.screenshot({ path: file, type: "jpeg", quality: 62 })
  await page.setViewportSize({ width: 1440, height: 900 })
}

for (const [viewportName, viewport] of [["1440x900", { width: 1440, height: 900 }], ["390x844", { width: 390, height: 844 }]] as const) {
  test.describe(`demo screenshots ${viewportName}`, () => {
    test.skip(!process.env.E2E_DEMO_SCREENSHOTS, "Set E2E_DEMO_SCREENSHOTS=1 (real project, demo loaded, server WITHOUT the bypass).")
    test.use({ viewport, hasTouch: viewportName === "390x844", isMobile: viewportName === "390x844" })
    test.setTimeout(180_000)
    const phone = viewportName === "390x844"
    const dir = join(OUT, viewportName)

    for (const screen of SCREENS) {
      test(screen.slug, async ({ page, context, baseURL }) => {
        mkdirSync(dir, { recursive: true })
        await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }, ...(await demoSessionCookies(EMAIL, baseURL!))])
        const boards = await boardIds(EMAIL)
        const path = typeof screen.path === "function" ? screen.path(boards) : screen.path
        const open = async () => {
          await page.goto(path)
          await settle(page)
        }
        await open()
        await expect(page.locator("body")).not.toContainText("Application error")
        await shoot(page, join(dir, `${screen.slug}-escuro.jpg`), phone)

        if (screen.tabs) {
          const tabs = page.getByRole("tablist").first().getByRole("tab")
          const names = await tabs.allInnerTexts()
          for (const name of names) {
            await page.getByRole("tablist").first().getByRole("tab", { name: name.trim() }).click()
            await page.waitForTimeout(700)
            await shoot(page, join(dir, `${screen.slug}-${slug(name)}-escuro.jpg`), phone)
          }
        }
        for (const [name, action] of screen.extra ?? []) {
          await open()
          await action(page).catch(() => undefined)
          await page.waitForTimeout(900)
          await shoot(page, join(dir, `${screen.slug}-${name}-escuro.jpg`), phone)
        }
        if (screen.light && !phone) {
          await open()
          await page.evaluate(() => document.documentElement.classList.remove("dark"))
          await page.waitForTimeout(700)
          await shoot(page, join(dir, `${screen.slug}-claro.jpg`), phone)
        }
      })
    }
  })
}
