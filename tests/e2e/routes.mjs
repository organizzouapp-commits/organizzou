// Route map: tab titles, canonical / Open Graph, redirects, anchors on /politicas.
//   PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100     (dashboard pages need the bypass)
//   node tests/e2e/routes.mjs            (BASE=http://localhost:3100)
import { chromium } from "@playwright/test"
import { skipConsent } from "./consent.mjs"

const base = process.env.BASE ?? "http://localhost:3100"
const browser = skipConsent(await chromium.launch(), base)
const results = []
const ok = (name, pass, extra = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`)

const DEFAULT = "Organizzou - Sua vida organizada"
const titles = [
  ["/", DEFAULT],
  ["/login", "Organizzou - Entrar"],
  ["/cadastro", "Organizzou - Criar conta"],
  ["/recuperar-senha", "Organizzou - Recuperar senha"],
  ["/recuperar-senha/nova-senha", "Organizzou - Nova senha"],
  ["/politicas", "Organizzou - Políticas"],
  ["/dashboard", "Organizzou - Início"],
  ["/dashboard/tarefas", "Organizzou - Tarefas"],
  ["/dashboard/rotina", "Organizzou - Rotina"],
  ["/dashboard/agenda", "Organizzou - Agenda"],
  ["/dashboard/financas", "Organizzou - Finanças"],
  ["/dashboard/treinos", "Organizzou - Treinos"],
  ["/dashboard/dieta", "Organizzou - Dieta"],
  ["/dashboard/estudos", "Organizzou - Estudos"],
  ["/dashboard/notas", "Organizzou - Notas e lembretes"],
  ["/dashboard/metas", "Organizzou - Metas"],
  ["/dashboard/diario", "Organizzou - Diário"],
  ["/dashboard/cofre", "Organizzou - Cofre"],
  ["/dashboard/configuracoes", "Organizzou - Configurações"],
]

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
for (const [path, expected] of titles) {
  await page.goto(base + path, { waitUntil: "networkidle" })
  await page.waitForTimeout(400)
  const title = await page.title()
  ok(`title ${path}`, title === expected, title === expected ? "" : `got "${title}"`)
}

// Public pages: canonical, og:site_name, og:locale, og:image.
for (const [path, canonical] of [["/", "/"], ["/politicas", "/politicas"], ["/login", "/login"], ["/cadastro", "/cadastro"]]) {
  await page.goto(base + path, { waitUntil: "networkidle" })
  const meta = await page.evaluate(() => ({
    canonical: document.querySelector("link[rel=canonical]")?.href,
    site: document.querySelector("meta[property='og:site_name']")?.content,
    locale: document.querySelector("meta[property='og:locale']")?.content,
    image: document.querySelector("meta[property='og:image']")?.content,
    lang: document.documentElement.lang,
  }))
  ok(`metadata ${path}`, meta.canonical === new URL(canonical, meta.canonical).href && meta.canonical?.endsWith(canonical === "/" ? "/" : canonical) && meta.site === "Organizzou" && meta.locale === "pt_BR" && meta.lang === "pt-BR", JSON.stringify(meta))
  if (path === "/") ok("og:image on /", Boolean(meta.image), meta.image)
}

// /politicas anchors.
for (const id of ["termos", "privacidade", "cookies"]) {
  await page.goto(`${base}/politicas#${id}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(400)
  const top = await page.evaluate((i) => document.getElementById(i)?.getBoundingClientRect().top ?? -1, id)
  ok(`/politicas#${id} section exists`, top >= 0 && top < 400, `top=${Math.round(top)}`)
}

// Old URLs end on the new ones (follow the 308).
for (const [from, to] of [["/entrar", "/login"], ["/hoje", "/dashboard"], ["/tarefas", "/dashboard/tarefas"], ["/em-breve", "/"], ["/termos", "/politicas#termos"], ["/privacidade", "/politicas#privacidade"], ["/redefinir-senha", "/recuperar-senha/nova-senha"]]) {
  await page.goto(base + from, { waitUntil: "domcontentloaded" })
  const u = new URL(page.url())
  ok(`redirect ${from}`, `${u.pathname}${u.hash}`.startsWith(to) || (to === "/dashboard/tarefas" && u.pathname.startsWith(to)), `${u.pathname}${u.hash}`)
}

console.log(results.join("\n"))
await browser.close()
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0)
