/**
 * Loads rich example data into ONE account that you name (the test account), so every screen can be seen full.
 *
 *   npm run seed:demo -- organizzouapp@gmail.com
 *   npm run seed:demo -- organizzouapp@gmail.com --reset    wipes that account's module data first, then loads the demo
 *
 * Guards:
 *   - it ALWAYS refuses patrick.toledo.barros@gmail.com (the personal account must stay clean);
 *   - it refuses when NODE_ENV=production unless you also pass --allow-production;
 *   - it refuses an account that already has data (habits, goals or events) unless you pass --reset;
 *   - it only writes rows for the one account you name, and nothing else is touched.
 * Needs SUPABASE_SECRET_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local (loaded by `node --env-file`). The key is never printed.
 */
import { randomUUID } from "node:crypto"

import { createClient } from "@supabase/supabase-js"

const PROTECTED = ["patrick.toledo.barros@gmail.com"]
const args = process.argv.slice(2)
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase()
const reset = args.includes("--reset")

if (!email) {
  console.error("Uso: npm run seed:demo -- <e-mail da conta de teste> [--reset]")
  process.exit(1)
}
if (PROTECTED.includes(email)) {
  console.error(`Recusado: ${email} é a conta pessoal e precisa ficar limpa (sem dados de demonstração).`)
  process.exit(1)
}
if (process.env.NODE_ENV === "production" && !args.includes("--allow-production")) {
  console.error("Recusado: NODE_ENV=production. Se você tem certeza, repita com --allow-production.")
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !secretKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.")
  process.exit(1)
}
const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

// ----- who ---------------------------------------------------------------------------------------------------------
async function findUser(target: string) {
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 1000) return null
  }
  return null
}
const user = await findUser(email)
if (!user) {
  console.error(`Não achei ${email} no Auth. A pessoa precisa entrar uma vez (Google ou e-mail) antes.`)
  process.exit(1)
}
const uid = user.id

const must = <T>(result: { data: T | null; error: { message: string } | null }, what: string): T => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`)
  return result.data as T
}
async function insert(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return
  const { error } = await db.from(table).insert(rows.map((row) => ({ user_id: uid, ...row })))
  if (error) throw new Error(`${table}: ${error.message}`)
}

// ----- dates (São Paulo) -------------------------------------------------------------------------------------------
const day = (offset = 0) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + offset * 86_400_000))
const at = (offset: number, time: string) => `${day(offset)}T${time}:00-03:00`
const weekday = (offset: number) => new Date(`${day(offset)}T12:00:00-03:00`).getUTCDay()

// ----- guards on existing data -------------------------------------------------------------------------------------
await db.rpc("provision_user", { p_user: uid }) // the defaults first (board, categories, account, goals), idempotent
const has = async (table: string) => ((await db.from(table).select("id", { count: "exact", head: true }).eq("user_id", uid)).count ?? 0) > 0
if (!reset && ((await has("habits")) || (await has("life_goals")) || (await has("events")))) {
  console.error(`${email} já tem dados nos módulos. Use --reset para apagar os dados dela e carregar a demonstração de novo.`)
  process.exit(1)
}
if (reset) {
  // Children first. Only this account's rows.
  for (const table of ["set_logs", "workout_sessions", "plan_exercises", "workout_plans", "meal_items", "water_logs", "weight_logs", "study_sessions", "study_deadlines", "flashcards", "flashcard_decks", "subjects", "reminders", "notes", "note_folders", "life_goal_links", "life_goal_milestones", "life_goals", "journal_entries", "habit_logs", "habits", "events", "finance_transactions", "finance_bills", "finance_goals", "tasks"]) {
    const { error } = await db.from(table).delete().eq("user_id", uid)
    if (error) throw new Error(`reset ${table}: ${error.message}`)
  }
  console.log("Dados anteriores apagados.")
}

// ----- demo --------------------------------------------------------------------------------------------------------
const hash = (n: number) => Math.abs(Math.sin(n * 9301 + 49297) * 233280) % 1 // deterministic "random" in [0, 1)

// Tasks, on the default board.
const board = must(await db.from("boards").select("id").eq("user_id", uid).order("created_at").limit(1).maybeSingle(), "board") as { id: string }
const lists = must(await db.from("board_lists").select("id, name, is_done_list").eq("board_id", board.id).order("position"), "lists") as { id: string; name: string; is_done_list: boolean }[]
const todo = lists[0].id
const doing = lists[1]?.id ?? todo
const done = lists.find((l) => l.is_done_list)?.id ?? todo
await insert("tasks", [
  { board_id: board.id, list_id: todo, title: "Pagar IPTU da segunda parcela", priority: "high", due_at: at(-2, "00:00"), due_has_time: false, position: 1000 },
  { board_id: board.id, list_id: todo, title: "Responder e-mails pendentes", priority: "medium", due_at: at(-1, "00:00"), due_has_time: false, position: 2000 },
  { board_id: board.id, list_id: todo, title: "Enviar relatório semanal", priority: "high", due_at: at(0, "17:00"), due_has_time: true, position: 3000 },
  { board_id: board.id, list_id: todo, title: "Marcar consulta no dentista", priority: "low", due_at: at(0, "09:00"), due_has_time: true, position: 4000 },
  { board_id: board.id, list_id: doing, title: "Preparar apresentação do trimestre", priority: "medium", due_at: at(3, "00:00"), due_has_time: false, position: 5000 },
  { board_id: board.id, list_id: todo, title: "Renovar o seguro do carro", priority: "none", due_at: at(6, "00:00"), due_has_time: false, position: 6000 },
  { board_id: board.id, list_id: todo, title: "Comprar presente da Marina", priority: "none", position: 7000 },
  { board_id: board.id, list_id: done, title: "Organizar a mesa de trabalho", priority: "none", due_at: at(0, "00:00"), due_has_time: false, completed_at: at(0, "08:10"), position: 8000 },
])

// Habits and 60 days of logs.
const habits = [
  { id: randomUUID(), name: "Meditar 10 minutos", type: "fixed", target_qty: null, unit: null, weekdays: [0, 1, 2, 3, 4, 5, 6], p: 0.8 },
  { id: randomUUID(), name: "Treinar", type: "fixed", target_qty: null, unit: null, weekdays: [1, 2, 4, 5], p: 0.75 },
  { id: randomUUID(), name: "Beber 2,5 litros de água", type: "goal", target_qty: 2.5, unit: "L", weekdays: [0, 1, 2, 3, 4, 5, 6], p: 0.7 },
  { id: randomUUID(), name: "Ler 20 páginas", type: "goal", target_qty: 20, unit: "páginas", weekdays: [0, 1, 2, 3, 4, 5, 6], p: 0.6 },
  { id: randomUUID(), name: "Estudar inglês", type: "goal", target_qty: 30, unit: "min", weekdays: [1, 2, 3, 4, 5], p: 0.65 },
]
await insert("habits", habits.map((h) => ({ id: h.id, name: h.name, type: h.type, target_qty: h.target_qty, unit: h.unit, weekdays: h.weekdays })))
const logs: Record<string, unknown>[] = []
habits.forEach((h, hi) => {
  for (let back = 59; back >= 1; back--) {
    if (!h.weekdays.includes(weekday(-back)) || hash(back * 7 + hi) > h.p) continue
    logs.push({ habit_id: h.id, log_date: day(-back), qty: h.type === "goal" ? Math.round((h.target_qty ?? 1) * (0.8 + hash(back + hi) * 0.4) * 10) / 10 : 1 })
  }
})
await insert("habit_logs", logs)

// Agenda.
await insert("events", [
  { title: "Reunião semanal do time", starts_at: at(-weekday(0) + 1, "10:00"), ends_at: at(-weekday(0) + 1, "11:00"), all_day: false, swatch: "lima-verso", rrule: "FREQ=WEEKLY;BYDAY=MO", reminder_offsets: [15], location: "Sala de reuniões 2" },
  { title: "Consulta com a Dra. Camila", starts_at: at(2, "14:00"), ends_at: at(2, "15:00"), all_day: false, swatch: "tinta-verso", location: "Clínica Sorriso", reminder_offsets: [60] },
  { title: "Aula de inglês", starts_at: at(1, "19:00"), ends_at: at(1, "20:00"), all_day: false, swatch: "neutro", rrule: "FREQ=WEEKLY;BYDAY=TU,TH" },
  { title: "Aniversário da Marina", starts_at: at(9, "00:00"), ends_at: at(9, "23:59"), all_day: true, swatch: "lima", rrule: "FREQ=YEARLY" },
])

// Finanças on top of the default categories and account.
const categories = must(await db.from("finance_categories").select("id, name").eq("user_id", uid), "categories") as { id: string; name: string }[]
const account = (must(await db.from("finance_accounts").select("id").eq("user_id", uid).order("created_at").limit(1).maybeSingle(), "account") as { id: string }).id
const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null
const limits: Record<string, number> = { Moradia: 240_000, Mercado: 120_000, Restaurantes: 50_000, Transporte: 40_000, Saúde: 30_000, Lazer: 35_000, Assinaturas: 20_000, Educação: 60_000 }
for (const [name, limit] of Object.entries(limits)) await db.from("finance_categories").update({ monthly_limit_cents: limit }).eq("user_id", uid).eq("name", name)
await db.from("finance_accounts").update({ name: "Conta Nubank", institution: "Nubank", opening_balance_cents: 1_500_000 }).eq("id", account)

const monthly = [
  { d: 5, kind: "in", cents: 780_000, what: "Salário", c: "Salário", method: "Transferência" },
  { d: 8, kind: "out", cents: 195_000, what: "Aluguel", c: "Moradia", method: "Boleto" },
  { d: 12, kind: "out", cents: 14_200, what: "Conta de luz", c: "Moradia", method: "Débito automático" },
  { d: 15, kind: "out", cents: 11_990, what: "Internet", c: "Moradia", method: "Débito automático" },
  { d: 20, kind: "out", cents: 5_590, what: "Netflix", c: "Assinaturas", method: "Cartão" },
  { d: 10, kind: "out", cents: 38_000, what: "Mercado", c: "Mercado", method: "Débito" },
  { d: 17, kind: "out", cents: 29_500, what: "Mercado", c: "Mercado", method: "Débito" },
  { d: 24, kind: "out", cents: 32_400, what: "Mercado", c: "Mercado", method: "Débito" },
  { d: 14, kind: "out", cents: 8_900, what: "Almoço com o time", c: "Restaurantes", method: "Pix" },
  { d: 22, kind: "out", cents: 15_600, what: "Jantar", c: "Restaurantes", method: "Cartão" },
  { d: 11, kind: "out", cents: 18_000, what: "Combustível", c: "Transporte", method: "Cartão" },
  { d: 19, kind: "out", cents: 12_000, what: "Cinema e lanche", c: "Lazer", method: "Cartão" },
]
const today = day(0)
const tx: Record<string, unknown>[] = []
for (let back = 0; back < 3; back++) {
  const base = new Date(`${today.slice(0, 7)}-01T12:00:00-03:00`)
  base.setMonth(base.getMonth() - back)
  const ym = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(base).slice(0, 7)
  for (const m of monthly) {
    const date = `${ym}-${String(m.d).padStart(2, "0")}`
    if (date > today) continue
    tx.push({ account_id: account, category_id: cat(m.c), kind: m.kind, amount_cents: m.cents + Math.round((hash(m.d + back) - 0.5) * 4000), occurred_on: date, method: m.method, description: m.what, source: "manual" })
  }
}
await insert("finance_transactions", tx)
await insert("finance_bills", [
  { name: "Aluguel", amount_cents: 195_000, due_day: 8, category_id: cat("Moradia"), active: true, last_paid_month: today.slice(0, 7) },
  { name: "Internet", amount_cents: 11_990, due_day: 15, category_id: cat("Moradia"), active: true },
  { name: "Netflix", amount_cents: 5_590, due_day: 20, category_id: cat("Assinaturas"), active: true },
])
await insert("finance_goals", [
  { name: "Reserva de emergência", target_cents: 1_000_000, current_cents: 350_000, deadline: day(240) },
  { name: "Viagem de fim de ano", target_cents: 600_000, current_cents: 120_000, deadline: day(150) },
])

// Treinos.
const catalog = must(await db.from("exercises").select("id, name").is("user_id", null), "exercises") as { id: string; name: string }[]
const ex = (name: string) => catalog.find((e) => e.name === name)!.id
const planA = randomUUID()
const planB = randomUUID()
await insert("workout_plans", [
  { id: planA, name: "Treino A — Peito e tríceps", weekdays: [1, 4] },
  { id: planB, name: "Treino B — Costas e bíceps", weekdays: [2, 5] },
])
const planItems = [
  { plan: planA, name: "Supino reto com barra", sets: 4, reps: 8, load: 60 },
  { plan: planA, name: "Supino inclinado com halteres", sets: 3, reps: 10, load: 22 },
  { plan: planA, name: "Tríceps na polia", sets: 3, reps: 12, load: 25 },
  { plan: planB, name: "Puxada frontal", sets: 4, reps: 10, load: 50 },
  { plan: planB, name: "Remada curvada", sets: 3, reps: 10, load: 45 },
  { plan: planB, name: "Rosca direta", sets: 3, reps: 12, load: 20 },
]
await insert("plan_exercises", planItems.map((p, i) => ({ plan_id: p.plan, exercise_id: ex(p.name), position: i, sets: p.sets, reps: p.reps, rest_seconds: 90, target_load_kg: p.load })))
const sessions: Record<string, unknown>[] = []
const sets: Record<string, unknown>[] = []
for (let back = 56; back >= 1; back--) {
  for (const [plan, weekdays] of [[planA, [1, 4]], [planB, [2, 5]]] as [string, number[]][]) {
    if (!weekdays.includes(weekday(-back)) || hash(back * 3) > 0.85) continue
    const id = randomUUID()
    sessions.push({ id, plan_id: plan, performed_on: day(-back), duration_min: 55 + Math.round(hash(back) * 15), completed: true })
    for (const p of planItems.filter((i) => i.plan === plan)) {
      for (let s = 1; s <= p.sets; s++) sets.push({ session_id: id, exercise_id: ex(p.name), set_index: s, reps: p.reps - (s === p.sets ? 1 : 0), load_kg: Math.round((p.load * (0.85 + ((56 - back) / 56) * 0.15)) / 2.5) * 2.5 })
    }
  }
}
await insert("workout_sessions", sessions)
await insert("set_logs", sets)

// Dieta.
const foods = must(await db.from("foods").select("id, name").is("user_id", null), "foods") as { id: string; name: string }[]
const food = (name: string) => foods.find((f) => f.name === name)!.id
await db.from("diet_goals").update({ kcal: 2200, protein_g: 140, carbs_g: 250, fat_g: 70, water_ml: 2500, target_weight_kg: 78 }).eq("user_id", uid)
await insert("meal_items", [
  { log_date: today, meal: "breakfast", food_id: food("Pão francês"), servings: 1 },
  { log_date: today, meal: "breakfast", food_id: food("Ovo cozido"), servings: 2 },
  { log_date: today, meal: "breakfast", food_id: food("Café com leite"), servings: 1 },
  { log_date: today, meal: "lunch", food_id: food("Arroz branco cozido"), servings: 2 },
  { log_date: today, meal: "lunch", food_id: food("Feijão carioca cozido"), servings: 1.5 },
  { log_date: today, meal: "lunch", food_id: food("Peito de frango grelhado"), servings: 1.5 },
  { log_date: today, meal: "snack", food_id: food("Banana prata"), servings: 1 },
])
await insert("water_logs", [{ log_date: today, ml: 750 }, { log_date: today, ml: 500 }])
await insert("weight_logs", Array.from({ length: 12 }, (_, i) => ({ log_date: day(-(11 - i) * 7), weight_kg: Math.round((82.4 - i * 0.22 + (i % 3 === 1 ? 0.3 : 0)) * 10) / 10 })))

// Estudos.
const subjects = [
  { id: randomUUID(), name: "Direito Constitucional", type: "subject", priority: "high", swatch: "lima-verso", weekly_goal_min: 300 },
  { id: randomUUID(), name: "Estatística", type: "subject", priority: "medium", swatch: "tinta-verso", weekly_goal_min: 180 },
  { id: randomUUID(), name: "Metodologia Científica", type: "book", priority: "low", swatch: "neutro", weekly_goal_min: 120, progress_pct: 45, progress_label: "pág. 210 de 464" },
]
await insert("subjects", subjects)
const studySessions: Record<string, unknown>[] = []
for (let back = 20; back >= 0; back--) {
  const s = subjects[back % 3]
  if (hash(back * 5) > 0.75) continue
  studySessions.push({ subject_id: s.id, studied_on: day(-back), minutes: 30 + Math.round(hash(back) * 60), mode: back % 2 === 0 ? "pomodoro" : "free" })
}
await insert("study_sessions", studySessions)
await insert("study_deadlines", [
  { subject_id: subjects[0].id, title: "Prova de Direito Constitucional", due_on: day(14), kind: "exam" },
  { subject_id: subjects[1].id, title: "Lista de exercícios de Estatística", due_on: day(5), kind: "delivery" },
])
const deck = randomUUID()
await insert("flashcard_decks", [{ id: deck, subject_id: subjects[0].id, name: "Direitos fundamentais" }])
await insert("flashcards", [
  ["O que é o habeas corpus?", "Ação que protege a liberdade de locomoção."],
  ["Qual o prazo do mandado de segurança?", "120 dias, contados da ciência do ato."],
  ["O que diz o art. 5º, caput?", "Todos são iguais perante a lei, sem distinção de qualquer natureza."],
  ["Quem pode propor ADI?", "Os legitimados do art. 103 da Constituição."],
  ["O que é cláusula pétrea?", "Matéria que não pode ser abolida por emenda constitucional."],
].map(([front, back], i) => ({ deck_id: deck, front, back, ease: 2.5, interval_days: i % 3, repetitions: i % 3, due_on: day(i < 3 ? 0 : i) })))

// Notas e lembretes.
const folderPersonal = randomUUID()
const folderWork = randomUUID()
await insert("note_folders", [{ id: folderPersonal, name: "Pessoal" }, { id: folderWork, name: "Trabalho" }])
await insert("notes", [
  { folder_id: folderWork, title: "Ata — alinhamento semanal", body: "## Alinhamento\nParticipantes: Marina, Rafael, Júlia e eu.\n- Decisões da semana\n- Próximos passos", pinned: true, tags: ["trabalho"] },
  { folder_id: folderPersonal, title: "Ideias de viagem", body: "# Fim de ano\n- Praia no litoral norte\n- Roteiro de 7 dias", pinned: true, tags: ["viagem"] },
  { folder_id: folderPersonal, title: "Lista do mercado", body: "- Arroz\n- Feijão\n- Frutas", pinned: false, tags: [] },
  { folder_id: null, title: "Livros para ler", body: "1. Hábitos atômicos\n2. A arte da guerra", pinned: false, tags: ["leitura"] },
])
await insert("reminders", [
  { title: "Ligar para o contador sobre o imposto de renda", remind_at: at(0, "15:00"), channels: ["push"], status: "pending" },
  { title: "Levar o carro para a revisão", remind_at: at(0, "17:30"), channels: ["push", "whatsapp"], status: "pending" },
  { title: "Renovar a assinatura do jornal", remind_at: at(4, "10:00"), channels: ["push"], status: "pending" },
])

// Metas.
const g1 = randomUUID()
const g2 = randomUUID()
await insert("life_goals", [
  { id: g1, title: "Passar no concurso", description: "Estudar toda semana e fechar o edital até dezembro.", deadline: day(120), status: "active" },
  { id: g2, title: "Correr 10 km", description: "Chegar aos 10 km sem parar.", deadline: day(90), status: "active" },
])
await insert("life_goal_links", [
  { goal_id: g1, module: "estudos", label: "Horas de estudo", done: 0, total: 80, unit: "h" },
  { goal_id: g2, module: "treinos", label: "Treinos feitos", done: 0, total: 20, unit: "treinos" },
])
await insert("life_goal_milestones", [
  { goal_id: g1, title: "Fechar o primeiro ciclo de revisão", done: true },
  { goal_id: g1, title: "Simulado completo", done: false },
  { goal_id: g2, title: "Correr 5 km", done: true },
  { goal_id: g2, title: "Correr 8 km", done: false },
])

// Diário: 21 days of check-ins.
const entries: Record<string, unknown>[] = []
for (let back = 21; back >= 1; back--) {
  if (hash(back * 11) > 0.85) continue
  entries.push({ entry_date: day(-back), mood: 2 + Math.round(hash(back * 2) * 3), text: back % 4 === 0 ? "Dia corrido, mas fechei o que importava." : "", sleep_hours: Math.round((6 + hash(back * 3) * 2.5) * 10) / 10 })
}
await insert("journal_entries", entries)

console.log(`Demonstração carregada em ${email}. Abra o app e recarregue a página.`)
