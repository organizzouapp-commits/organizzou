/**
 * Smoke sweep: visits every route at 1440x900 and 390x844, clicks every visible button / tab / menu item / switch (cancelling
 * destructive ones) and writes docs/QA-REPORT.md.
 *
 * The prototype has no real sign-in yet (all data is mock), so the dashboard is reached with PROTOTYPE_BYPASS_AUTH=1 (dev only).
 *   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
 *   npx playwright test smoke            (BASE=http://localhost:3100)
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"

const ROUTES = [
  "/",
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/recuperar-senha/nova-senha",
  "/politicas",
  "/dashboard",
  "/dashboard/tarefas",
  "/dashboard/rotina",
  "/dashboard/agenda",
  "/dashboard/financas",
  "/dashboard/treinos",
  "/dashboard/dieta",
  "/dashboard/estudos",
  "/dashboard/notas",
  "/dashboard/metas",
  "/dashboard/diario",
  "/dashboard/cofre",
  "/dashboard/perfil",
  "/dashboard/configuracoes",
  "/dashboard/ajuda",
]
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]
const DESTRUCTIVE = /exclu|apag|remov|delet|limpar|sair|encerrar|cancelar conta|reset|zerar|descartar|arquivar|desconectar/i
const MAX_CLICKS = Number(process.env.MAX_CLICKS ?? 60)
const SELECTOR = 'button, [role=tab], [role=switch], [role=menuitem], [role=checkbox], a[href], summary, [role=combobox]'

type Row = { route: string; viewport: string; element: string; problem: string; severity: "alta" | "média" | "baixa" }
const rows: Row[] = []
const add = (route: string, viewport: string, element: string, problem: string, severity: Row["severity"]) => {
  if (!rows.some((r) => r.route === route && r.viewport === viewport && r.element === element && r.problem === problem)) rows.push({ route, viewport, element, problem, severity })
}

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))

/** A click can navigate while we evaluate: wait for the new document and try again. */
async function settled<T>(page: Page, run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    } catch (e) {
      if (attempt >= 3) throw e
      await page.waitForLoadState("domcontentloaded").catch(() => {})
      await page.waitForTimeout(400)
    }
  }
}

async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const out: { kind: "overflow-x" | "clipped"; el: string }[] = []
    const name = (el: Element) => {
      const text = (el.textContent ?? "").trim().slice(0, 28)
      return `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""}${text ? ` "${text}"` : ""}`
    }
    const doc = document.documentElement
    if (doc.scrollWidth > innerWidth + 1) out.push({ kind: "overflow-x", el: `document (${doc.scrollWidth}px > ${innerWidth}px)` })
    // Text cut in the middle of a word: a leaf element with overflow hidden that is narrower than its text and has no ellipsis.
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const cs = getComputedStyle(el)
      if (cs.display === "none" || cs.visibility === "hidden") continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const hidden = cs.overflowX === "hidden" || cs.overflowX === "clip"
      if (hidden && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== "ellipsis" && el.children.length === 0 && (el.textContent ?? "").trim().length > 1 && !el.closest("[aria-hidden=true], .sr-only"))
        out.push({ kind: "clipped", el: name(el) })
    }
    return out.slice(0, 8)
  })
}

async function interactive(page: Page) {
  return page.evaluate((sel) => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true" && !el.closest("[inert]")
    })
    const label = (el: HTMLElement) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 40)
    return els.map((el, idx) => ({ idx, label: label(el), tag: el.tagName.toLowerCase(), href: el.getAttribute("href") }))
  }, SELECTOR)
}

function writeReport() {
  const order = { alta: 0, média: 1, baixa: 2 }
  rows.sort((a, b) => order[a.severity] - order[b.severity] || a.route.localeCompare(b.route))
  const md = [
    "# Relatório de QA (smoke sweep)",
    "",
    `Gerado por \`tests/e2e/smoke.spec.ts\` em ${new Date().toISOString().slice(0, 10)}. Rotas: ${ROUTES.length}, viewports: 1440x900 e 390x844, até ${MAX_CLICKS} cliques por tela. Modo dev com \`PROTOTYPE_BYPASS_AUTH=1\` (o protótipo usa dados de exemplo; não há login real ainda).`,
    "",
    rows.length ? "| Severidade | Rota | Viewport | Elemento | Problema |\n|---|---|---|---|---|" : "Nenhum problema encontrado.",
    ...rows.map((r) => `| ${r.severity} | ${r.route} | ${r.viewport} | ${r.element.replace(/\|/g, "\\|")} | ${r.problem.replace(/\|/g, "\\|")} |`),
    "",
  ].join("\n")
  mkdirSync("docs", { recursive: true })
  writeFileSync(process.env.QA_REPORT ?? "docs/QA-REPORT.md", md)
}

test("smoke sweep", async ({ browser, baseURL }) => {
  test.setTimeout(90 * 60_000)
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.name === "mobile" })
    await ctx.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }])
    const page = await ctx.newPage()
    let route = ""
    let activeEl = "(load)"
    let requests = 0
    page.on("request", () => requests++)
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") {
        const t = m.text().slice(0, 160)
        if (/Download the React DevTools|Fast Refresh|HMR|webpack-hmr/i.test(t)) return
        add(route, vp.name, activeEl, `console.${m.type()}: ${t}`, m.type() === "error" ? "alta" : "baixa")
      }
    })
    page.on("pageerror", (e) => add(route, vp.name, activeEl, `exceção: ${String(e.message).slice(0, 160)}`, "alta"))
    page.on("response", (r) => {
      if (r.status() >= 400 && !/favicon|\/_next\/image/.test(r.url())) add(route, vp.name, activeEl, `HTTP ${r.status()} ${new URL(r.url()).pathname}`, "alta")
    })
    await page.addInitScript(() => {
      window.addEventListener("unhandledrejection", (e) => console.error("unhandledrejection: " + String(e.reason)))
      const w = window as unknown as { __mut: number }
      w.__mut = 0
      new MutationObserver((l) => (w.__mut += l.length)).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
    })

    for (const path of ROUTES) {
      route = path
      console.log(`[smoke] ${vp.name} ${path}`)
      writeReport()
      activeEl = "(load)"
      try {
        await page.goto(path, { waitUntil: "networkidle", timeout: 90_000 })
      } catch (e) {
        add(path, vp.name, "(load)", `falha ao carregar: ${String(e).slice(0, 100)}`, "alta")
        continue
      }
      await page.waitForTimeout(500)
      for (const p of await settled(page, () => layoutProblems(page))) add(path, vp.name, p.el, p.kind === "overflow-x" ? "overflow horizontal" : "texto cortado (sem reticências)", p.kind === "overflow-x" ? "alta" : "média")

      const startUrl = page.url()
      const seen = new Set<string>()
      for (let i = 0; i < MAX_CLICKS; i++) {
        const list = await settled(page, () => interactive(page))
        const next = list.find(
          (t) =>
            !seen.has(`${t.tag}|${t.label}|${t.href}`) &&
            !DESTRUCTIVE.test(t.label) &&
            !(t.tag === "a" && t.href && (/^https?:/.test(t.href) || t.href.startsWith("mailto:") || t.href.startsWith("tel:")))
        )
        if (!next) break
        seen.add(`${next.tag}|${next.label}|${next.href}`)
        activeEl = `${next.tag} "${next.label || "(sem nome)"}"`
        const before = await settled(page, () => page.evaluate(() => ({ mut: (window as unknown as { __mut: number }).__mut, url: location.href })))
        const reqBefore = requests
        try {
          const handle = (
            await page.evaluateHandle(
              ([sel, idx]) => {
                const els = Array.from(document.querySelectorAll<HTMLElement>(sel as string)).filter((el) => {
                  const r = el.getBoundingClientRect()
                  const cs = getComputedStyle(el)
                  return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true" && !el.closest("[inert]")
                })
                return els[idx as number]
              },
              [SELECTOR, next.idx] as const
            )
          ).asElement()
          if (!handle) continue
          await handle.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
          await handle.click({ timeout: 3000 })
        } catch {
          add(path, vp.name, activeEl, "não foi possível clicar (coberto/instável)", "baixa")
          await page.keyboard.press("Escape").catch(() => {})
          continue
        }
        await page.waitForTimeout(350)
        const after = await settled(page, () => page.evaluate(() => ({ mut: (window as unknown as { __mut: number }).__mut, url: location.href })))
        if (after.url === before.url && after.mut === before.mut && requests === reqBefore) add(path, vp.name, activeEl, "clique não fez nada (sem URL, DOM ou rede)", "média")
        for (const p of await settled(page, () => layoutProblems(page))) add(path, vp.name, `${activeEl} → ${p.el}`, p.kind === "overflow-x" ? "overflow horizontal" : "texto cortado (sem reticências)", p.kind === "overflow-x" ? "alta" : "média")
        // Cancel any overlay we opened and come back if we navigated away.
        for (let k = 0; k < 3; k++) await page.keyboard.press("Escape").catch(() => {})
        if (new URL(page.url()).pathname !== new URL(startUrl).pathname) {
          await page.goto(startUrl, { waitUntil: "domcontentloaded" }).catch(() => {})
          await page.waitForTimeout(300)
        }
      }
    }
    await ctx.close()
  }

  writeReport()
  expect(true).toBe(true)
})
