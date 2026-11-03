/**
 * Quick capture ("Novo"): what is typed always ends up saved, and it is still there after a reload.
 *   E2E_DEMO_SESSION=1 npx playwright test quick-capture      (server WITHOUT the login bypass, demo loaded)
 * Real rows are created on the demo account with a unique marker in their text, checked in the database after a reload, and removed
 * at the end. No model is called here (the rule parser handles the clear cases; the unsure case goes to the Inbox note, which is also
 * what happens when no ANTHROPIC_API_KEY is set).
 */
import { createClient } from "@supabase/supabase-js"
import { expect, test, type Page } from "@playwright/test"

import { demoSessionCookies, loadEnv } from "./helpers/demo-session"

const CONSENT = encodeURIComponent(JSON.stringify({ version: 1, necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }))
const EMAIL = "organizzouapp@gmail.com"
const MARK = `zq${Date.now().toString(36)}`

test.skip(!process.env.E2E_DEMO_SESSION, "needs E2E_DEMO_SESSION=1 and the real-auth server")
test.describe.configure({ mode: "serial" })
test.use({ viewport: { width: 1440, height: 900 } })

function admin() {
  const { url, secret } = loadEnv()
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function demoUserId() {
  const db = admin()
  for (let page = 1; page <= 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    const found = data?.users.find((u) => u.email?.toLowerCase() === EMAIL)
    if (found) return found.id
    if ((data?.users.length ?? 0) < 1000) break
  }
  throw new Error("demo user not found")
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "organizzou_consent", value: CONSENT, url: baseURL! }, ...(await demoSessionCookies(EMAIL, baseURL!))])
})

async function capture(page: Page, text: string) {
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Novo", exact: true }).first().click()
  const box = page.getByRole("textbox", { name: "O que você quer registrar?" })
  await expect(box).toBeFocused()
  await box.fill(text)
  // The live preview names what will be created.
  await expect(page.getByText("Vou criar:")).toBeVisible()
  return box
}

test("a task: Enter saves it, the toast says what was created, and it survives a reload", async ({ page }) => {
  const box = await capture(page, `pagar taxa ${MARK} sexta`)
  await expect(page.locator('[data-capture-type="tarefa"]')).toContainText(`Pagar taxa ${MARK}`)
  await box.press("Enter")
  await expect(page.getByText(new RegExp(`Tarefa criada: Pagar taxa ${MARK}`))).toBeVisible({ timeout: 20000 })
  await page.goto("/dashboard/tarefas")
  await expect(page.getByText(`Pagar taxa ${MARK}`).first()).toBeVisible({ timeout: 30000 })
  await page.reload()
  await expect(page.getByText(`Pagar taxa ${MARK}`).first()).toBeVisible({ timeout: 30000 })
})

test("Shift+Enter breaks the line instead of saving", async ({ page }) => {
  const box = await capture(page, `linha um ${MARK}`)
  await box.press("Shift+Enter")
  await box.pressSequentially("linha dois")
  await expect(box).toHaveValue(`linha um ${MARK}\nlinha dois`)
  await expect(box).toBeVisible()
  // Nothing was saved by the line break.
  const notes = await admin().from("notes").select("id").eq("user_id", await demoUserId()).ilike("body", `%linha um ${MARK}%`)
  expect(notes.data).toEqual([])
})

test("an expense, a note and a habit are created and persist (checked in the database after a reload)", async ({ page }) => {
  for (const text of [`gastei 45 na padaria ${MARK}`, `anota que ${MARK} anotacao`, `criar hábito de ${MARK}`]) {
    const box = await capture(page, text)
    await box.press("Enter")
    await expect(page.getByText(/registrado|criada|criado|Hábito criado/).first()).toBeVisible({ timeout: 20000 })
    await page.getByRole("textbox", { name: "O que você quer registrar?" }).waitFor({ state: "detached" })
  }
  await page.reload()
  const db = admin()
  const uid = await demoUserId()
  const [tx, notes, habits] = await Promise.all([
    db.from("finance_transactions").select("amount_cents, kind, description").eq("user_id", uid).ilike("description", `%${MARK}%`),
    db.from("notes").select("title").eq("user_id", uid).ilike("body", `%${MARK}%`),
    db.from("habits").select("name").eq("user_id", uid).ilike("name", `%${MARK}%`),
  ])
  expect(tx.data).toEqual([{ amount_cents: 4500, kind: "out", description: expect.stringContaining(MARK) }])
  expect(notes.data?.length).toBe(1)
  expect(habits.data?.length).toBe(1)
})

test("an unclear text is never dropped: it becomes a note in the Inbox, with a way to convert it", async ({ page }) => {
  const box = await capture(page, `aquele negocio ${MARK} do joao`)
  await expect(page.locator('[data-capture-type="inbox"]')).toBeVisible()
  await box.press("Enter")
  await expect(page.getByText("Salvei como nota.")).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole("button", { name: "Tarefa" })).toBeVisible()
  await page.reload()
  const db = admin()
  const uid = await demoUserId()
  const note = await db.from("notes").select("body, folder_id").eq("user_id", uid).ilike("body", `%${MARK} do joao%`)
  expect(note.data?.length).toBe(1)
  const folder = await db.from("note_folders").select("name").eq("id", note.data![0].folder_id).single()
  expect(folder.data?.name).toBe("Inbox")
})

test("two things in one text create two records, and Desfazer takes them back", async ({ page }) => {
  const box = await capture(page, `pagar luz ${MARK} sexta e comprar pão ${MARK}`)
  await expect(page.locator('[data-capture-type="tarefa"]')).toHaveCount(2)
  await box.press("Enter")
  await expect(page.getByText("2 itens criados")).toBeVisible({ timeout: 20000 })
  const db = admin()
  const uid = await demoUserId()
  await expect.poll(async () => (await db.from("tasks").select("id").eq("user_id", uid).ilike("title", `%${MARK}%`).like("title", "%luz%")).data?.length).toBe(1)
  await page.getByRole("button", { name: "Desfazer" }).click()
  await expect(page.getByText("Desfeito.")).toBeVisible()
  await expect.poll(async () => (await db.from("tasks").select("id").eq("user_id", uid).ilike("title", `%${MARK}%`).or("title.ilike.%luz%,title.ilike.%pão%")).data?.length).toBe(0)
})

test("the mobile drawer opens and saves", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/dashboard")
  await page.getByRole("button", { name: /^Novo$/ }).first().click()
  const box = page.getByRole("textbox", { name: "O que você quer registrar?" })
  await expect(box).toBeVisible()
  await box.fill(`bebi 300 ml de água ${MARK}`)
  await expect(page.locator('[data-capture-type="agua"]')).toBeVisible()
  await box.press("Enter")
  await expect(page.getByText(/Água registrada/)).toBeVisible({ timeout: 20000 })
})

test("the notifications list scrolls without a visible scrollbar, capped at 70% of the screen height", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 420 })
  await page.goto("/dashboard")
  await page.getByRole("button", { name: /^Notificações/ }).first().click()
  const list = page.locator("[data-slot=popover-content] ul").first()
  await expect(list).toBeVisible()
  const style = await list.evaluate((node) => { const el = node as HTMLElement; return ({ width: getComputedStyle(el).scrollbarWidth, max: el.getBoundingClientRect().height, scrolls: el.scrollHeight > el.clientHeight, gutter: el.offsetWidth - el.clientWidth }) })
  expect(style.width).toBe("none")
  expect(style.gutter).toBe(0)
  expect(style.max).toBeLessThanOrEqual(420 * 0.7 + 1)
  // The list still moves by wheel, and fades at the bottom while there is more below.
  if (style.scrolls) {
    await list.hover()
    await page.mouse.wheel(0, 200)
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  }
})

test.afterAll(async () => {
  const db = admin()
  const uid = await demoUserId()
  await db.from("tasks").delete().eq("user_id", uid).ilike("title", `%${MARK}%`)
  await db.from("finance_transactions").delete().eq("user_id", uid).ilike("description", `%${MARK}%`)
  await db.from("notes").delete().eq("user_id", uid).ilike("body", `%${MARK}%`)
  await db.from("habits").delete().eq("user_id", uid).ilike("name", `%${MARK}%`)
  await db.from("water_logs").delete().eq("user_id", uid).eq("ml", 300).gte("created_at", new Date(Date.now() - 3_600_000).toISOString())
  await db.from("audit_log").delete().eq("user_id", uid).ilike("payload->>label", `%${MARK}%`)
})

test("the assistant chat opens; without a server key it says so honestly and does not pretend to answer", async ({ page }) => {
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Abrir o assistente" }).first().click()
  const sheet = page.getByRole("dialog", { name: "Assistente" })
  await expect(sheet).toBeVisible()
  const state = sheet.getByText("Assistente indisponível").or(sheet.getByRole("textbox", { name: "Mensagem para o assistente" }))
  await expect(state.first()).toBeVisible({ timeout: 20000 })
  if (await sheet.getByText("Assistente indisponível").isVisible()) await expect(sheet.getByRole("textbox", { name: "Mensagem para o assistente" })).toHaveCount(0)
})
