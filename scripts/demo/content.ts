/**
 * The demo content: what the app used to show as built-in example data, rebuilt as rows for the REAL tables. It is pure (no
 * database, no clock of its own) so tests can check it: every module is covered, every id is stable, and nothing depends on when
 * it runs except the dates, which are all relative to `now` in America/Sao_Paulo.
 *
 * Ids are deterministic (a hash of `table:key`), so loading it again replaces the same rows instead of adding new ones, and the reset
 * can find exactly the rows the demo created.
 */
import { createHash } from "node:crypto"

export type Row = Record<string, unknown>

/** What already exists in the account (created by the sign-up provisioning or the catalogs) that demo rows point to. */
export type Refs = {
  /** The account the rows are for: attachment files live under `<user id>/...` in Storage. */
  userId: string
  categories: Record<string, string>
  foods: Record<string, string>
  exercises: Record<string, string>
}

/** The text of each demo attachment, by file name (the seed uploads them to Storage before the rows that point at them). */
export const DEMO_FILE_BODIES: Record<string, string> = {}

export type Demo = { table: string; rows: Row[] }[]

/** Deterministic uuid (version 5 layout) for a demo row. */
export function demoId(table: string, key: string): string {
  const h = createHash("sha1").update(`organizzou-demo:${table}:${key}`).digest()
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const hex = h.subarray(0, 16).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/** Tables in the order rows can be inserted (parents first). Deleting walks it backwards. */
export const DEMO_TABLES = [
  "tags",
  "boards",
  "board_lists",
  "tasks",
  "task_tags",
  "task_checklist_items",
  "task_comments",
  "attachments",
  "habits",
  "habit_logs",
  "events",
  "finance_accounts",
  "finance_transactions",
  "finance_bills",
  "finance_goals",
  "workout_plans",
  "plan_exercises",
  "workout_sessions",
  "set_logs",
  "meal_items",
  "water_logs",
  "weight_logs",
  "subjects",
  "study_sessions",
  "study_deadlines",
  "flashcard_decks",
  "flashcards",
  "note_folders",
  "notes",
  "reminders",
  "life_goals",
  "life_goal_links",
  "life_goal_milestones",
  "journal_entries",
  "notifications",
] as const

/** Fallback monthly limits for categories with nothing spent yet this month (the reset puts every limited category back to "no limit"). */
export const DEMO_CATEGORY_LIMITS: Record<string, number> = {
  Moradia: 240_000,
  Mercado: 120_000,
  Restaurantes: 50_000,
  Transporte: 40_000,
  Saúde: 30_000,
  Lazer: 35_000,
  Assinaturas: 20_000,
  Educação: 60_000,
}

const sp = (date: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(date)

export function buildDemo(now: Date, refs: Refs): Demo {
  const day = (offset = 0) => sp(new Date(now.getTime() + offset * 86_400_000))
  /** An instant at a São Paulo wall-clock time, `offset` days from today. */
  const at = (offset: number, time = "12:00") => `${day(offset)}T${time}:00-03:00`
  const weekday = (offset: number) => new Date(`${day(offset)}T12:00:00-03:00`).getUTCDay()
  const id = demoId
  const out: Record<string, Row[]> = Object.fromEntries(DEMO_TABLES.map((t) => [t, []]))
  const add = (table: (typeof DEMO_TABLES)[number], ...rows: Row[]) => void out[table].push(...rows)
  const category = (name: string) => refs.categories[name] ?? null

  // ------------------------------------------------------------------------------------------------ Tarefas
  const tagDefs: [string, string, string][] = [
    ["work", "Trabalho", "tinta-verso"],
    ["personal", "Pessoal", "lima-verso"],
    ["urgent", "Urgente", "lima"],
    ["home", "Casa", "grafite"],
    ["study", "Estudos", "papel"],
  ]
  for (const [key, name, swatch] of tagDefs) add("tags", { id: id("tags", key), name, swatch })

  type TaskSeed = {
    key: string
    title: string
    description?: string
    priority?: string
    due?: [number, string?] // [offset days, time]; no time = all day
    category?: string
    swatch?: string
    tags?: string[]
    checklist?: [number, number] // [total, done]
    comments?: string[]
    attachments?: [name: string, mime: string, text: string][]
    done?: boolean
  }
  const boards: { key: string; name: string; lists: string[]; tasks: TaskSeed[][] }[] = [
    {
      key: "work",
      name: "Trabalho",
      lists: ["A fazer", "Em andamento", "Concluído"],
      tasks: [
        [
          { key: "report", title: "Enviar relatório semanal à Marina", description: "Resumir entregas da semana, indicadores de vendas e pendências.", priority: "high", due: [0, "17:00"], category: "Relatórios", swatch: "tinta-verso", tags: ["work", "urgent"], checklist: [3, 1], comments: ["Marina pediu o gráfico de vendas por região.", "Anexei a planilha de custos na pasta compartilhada."] },
          { key: "proposal", title: "Revisar proposta do cliente Almeida & Filhos", priority: "medium", due: [1, "10:00"], category: "Comercial", swatch: "lima", tags: ["work"], attachments: [["proposta-almeida.txt", "text/plain", "Proposta comercial — Almeida & Filhos\n\nEscopo, prazos e condições de pagamento (exemplo de demonstração)."]] },
          { key: "costs", title: "Atualizar planilha de custos do trimestre", priority: "low", due: [4], tags: ["work"] },
          { key: "emails", title: "Responder e-mails pendentes", priority: "none", due: [-1], tags: ["work"] },
        ],
        [
          { key: "slides", title: "Preparar apresentação de resultados do 3º trimestre", description: "Slides com gráficos de faturamento e metas atingidas.", priority: "high", due: [2, "14:00"], category: "Reunião", swatch: "tinta-verso", tags: ["work", "urgent"], checklist: [5, 3], comments: ["Faltam os números de outubro."], attachments: [["resultados-3tri.txt", "text/plain", "Resultados do 3º trimestre — faturamento, metas e pendências (demonstração)."], ["roteiro-apresentacao.txt", "text/plain", "Roteiro da apresentação: abertura, números, próximos passos (demonstração)."]] },
          { key: "interview", title: "Entrevistar candidata para vaga de analista", priority: "medium", due: [3, "11:00"], tags: ["work"] },
        ],
        [
          { key: "supplier", title: "Fechar contrato com fornecedor de embalagens", priority: "medium", tags: ["work"], done: true },
          { key: "invoices", title: "Conciliar notas fiscais de setembro", priority: "low", tags: ["work"], done: true },
        ],
      ],
    },
    {
      key: "home",
      name: "Casa e vida",
      lists: ["Ideias", "Fazendo", "Feito"],
      tasks: [
        [
          { key: "plant", title: "Comprar planta para a sala", swatch: "lima-verso", tags: ["home"] },
          { key: "trip", title: "Planejar viagem de fim de ano para Florianópolis", priority: "low", due: [20], category: "Viagem", tags: ["personal"], checklist: [4, 1] },
          { key: "photo", title: "Pesquisar curso de fotografia", tags: ["personal", "study"] },
        ],
        [
          { key: "closet", title: "Organizar o guarda-roupa", priority: "medium", due: [1], swatch: "grafite", tags: ["home"] },
          { key: "dentist", title: "Marcar consulta no dentista", priority: "medium", due: [0, "09:00"], category: "Saúde", swatch: "lima", tags: ["personal"] },
          { key: "iptu", title: "Pagar IPTU da segunda parcela", priority: "high", due: [-2], tags: ["home", "urgent"] },
        ],
        [
          { key: "bulb", title: "Trocar a lâmpada da cozinha", tags: ["home"], done: true },
          { key: "insurance", title: "Renovar o seguro do carro", tags: ["personal"], done: true },
        ],
      ],
    },
    {
      key: "college",
      name: "Faculdade",
      lists: ["A estudar", "Em curso", "Entregue"],
      tasks: [
        [
          { key: "chapter", title: "Ler capítulo 4 de Direito Constitucional", priority: "medium", due: [2], tags: ["study"] },
          { key: "exercises", title: "Resolver lista de exercícios de Estatística", priority: "high", due: [5], tags: ["study"] },
        ],
        [{ key: "paper", title: "Escrever artigo de Metodologia Científica", priority: "high", due: [9], tags: ["study"], checklist: [6, 2] }],
        [{ key: "essay", title: "Entregar resenha de Sociologia", tags: ["study"], done: true }],
      ],
    },
  ]
  boards.push({
    key: "app",
    name: "Lançamento do app",
    lists: ["Backlog", "A fazer", "Em andamento", "Concluído"],
    tasks: [
      [
        { key: "pricing", title: "Definir a página de preços", priority: "medium", due: [12], tags: ["work"] },
        { key: "faq", title: "Escrever as perguntas frequentes", priority: "low", tags: ["work", "personal"] },
      ],
      [
        { key: "onboarding", title: "Revisar o texto do primeiro acesso", priority: "high", due: [1, "15:30"], category: "Produto", swatch: "lima", tags: ["work", "urgent"], checklist: [4, 2], comments: ["Trocar 'bem-vindo' por algo mais direto."] },
        { key: "beta", title: "Convidar 10 pessoas para o beta", priority: "medium", due: [3], tags: ["work"] },
      ],
      [{ key: "landing", title: "Ajustar a página inicial no celular", priority: "high", due: [0, "11:00"], category: "Design", swatch: "tinta-verso", tags: ["work"], checklist: [3, 1] }],
      [
        { key: "domain", title: "Registrar o domínio", tags: ["work"], done: true },
        { key: "logo", title: "Fechar o logotipo", tags: ["work"], done: true },
      ],
    ],
  })
  boards.forEach((b, bi) => {
    const boardId = id("boards", b.key)
    add("boards", { id: boardId, name: `${b.name}`, position: (bi + 1) * 1000 + 500, archived: false })
    b.lists.forEach((listName, li) => {
      const listId = id("board_lists", `${b.key}:${li}`)
      add("board_lists", { id: listId, board_id: boardId, name: listName, position: (li + 1) * 1000, is_done_list: li === b.lists.length - 1 })
      b.tasks[li].forEach((t, ti) => {
        const taskId = id("tasks", `${b.key}:${t.key}`)
        add("tasks", {
          id: taskId,
          board_id: boardId,
          list_id: listId,
          title: t.title,
          description: t.description ?? null,
          priority: t.priority ?? "none",
          due_at: t.due ? at(t.due[0], t.due[1] ?? "00:00") : null,
          due_has_time: Boolean(t.due?.[1]),
          category: t.category ?? null,
          swatch: t.swatch ?? "neutro",
          position: (ti + 1) * 1000,
          completed_at: li === b.lists.length - 1 ? at(-1 - ti, "16:30") : null,
          archived: false,
        })
        for (const tag of t.tags ?? []) add("task_tags", { id: id("task_tags", `${b.key}:${t.key}:${tag}`), task_id: taskId, tag_id: id("tags", tag) })
        if (t.checklist) {
          for (let n = 0; n < t.checklist[0]; n++) add("task_checklist_items", { id: id("task_checklist_items", `${b.key}:${t.key}:${n}`), task_id: taskId, text: `Etapa ${n + 1} de ${t.title.split(" ").slice(0, 3).join(" ")}`, done: n < t.checklist[1], position: (n + 1) * 1000 })
        }
        ;(t.comments ?? []).forEach((body, n) => add("task_comments", { id: id("task_comments", `${b.key}:${t.key}:${n}`), task_id: taskId, body }))
        ;(t.attachments ?? []).forEach(([name, mime, text], n) => {
          const attachmentId = id("attachments", `${b.key}:${t.key}:${n}`)
          DEMO_FILE_BODIES[name] = text
          add("attachments", { id: attachmentId, entity_type: "task", entity_id: taskId, storage_path: `${refs.userId}/${taskId}/${attachmentId}-${name}`, file_name: name, mime_type: mime, size_bytes: Buffer.byteLength(text) })
        })
      })
    })
  })

  // ------------------------------------------------------------------------------------------------ Rotina
  const ALL = [0, 1, 2, 3, 4, 5, 6]
  const habits = [
    { key: "water", name: "Beber 2,5 litros de água", type: "goal", target_qty: 2.5, unit: "L", weekdays: ALL, paused: false },
    { key: "read", name: "Ler 20 páginas", type: "goal", target_qty: 20, unit: "páginas", weekdays: ALL, paused: false },
    { key: "train", name: "Treinar", type: "fixed", target_qty: null, unit: null, weekdays: [1, 2, 4, 5], paused: false },
    { key: "meditate", name: "Meditar 10 minutos", type: "fixed", target_qty: null, unit: null, weekdays: ALL, paused: false },
    { key: "english", name: "Estudar inglês", type: "goal", target_qty: 30, unit: "min", weekdays: [1, 2, 3, 4, 5], paused: false },
    { key: "run", name: "Correr 5 km", type: "fixed", target_qty: null, unit: null, weekdays: [6], paused: true },
    // Taken every day for 40 days, today still pending: a long streak that shows the flame, and a fixed habit that is not done yet.
    { key: "vitamin", name: "Tomar vitamina D", type: "fixed", target_qty: null, unit: null, weekdays: ALL, paused: false },
  ]
  habits.forEach((h, hi) => {
    add("habits", { id: id("habits", h.key), name: h.name, type: h.type, target_qty: h.target_qty, unit: h.unit, weekdays: h.weekdays, deadline: null, paused: h.paused })
    // About 70% of the scheduled days in the last 90 are done; a longer recent run makes streaks look real. Today stays open.
    for (let i = 1; i <= 90; i++) {
      if (!h.weekdays.includes(weekday(-i))) continue
      const done = h.key === "vitamin" ? i <= 40 : i <= hi + 3 || (i * 7 + hi * 13) % 10 < 7
      if (!done) continue
      add("habit_logs", { id: id("habit_logs", `${h.key}:${i}`), habit_id: id("habits", h.key), log_date: day(-i), qty: h.type === "goal" ? (h.target_qty ?? 1) : 1 })
    }
  })
  // Today: water half done, meditation checked.
  add("habit_logs", { id: id("habit_logs", "water:today"), habit_id: id("habits", "water"), log_date: day(0), qty: 1.5 }, { id: id("habit_logs", "meditate:today"), habit_id: id("habits", "meditate"), log_date: day(0), qty: 1 }, { id: id("habit_logs", "read:today"), habit_id: id("habits", "read"), log_date: day(0), qty: 20 })

  // ------------------------------------------------------------------------------------------------ Agenda
  const events: { key: string; title: string; start: [number, string]; end: [number, string]; allDay?: boolean; category: string; location?: string; swatch: string; rrule?: string; reminders?: number[]; startsAt?: string; endsAt?: string }[] = [
    { key: "sync", title: "Alinhamento semanal do time", start: [-60, "10:00"], end: [-60, "11:00"], category: "Trabalho", location: "Sala de reuniões 2", swatch: "tinta-verso", rrule: "FREQ=WEEKLY;BYDAY=MO", reminders: [10] },
    { key: "english", title: "Aula de inglês", start: [-60, "19:00"], end: [-60, "20:00"], category: "Estudos", location: "Online — Zoom", swatch: "lima-verso", rrule: "FREQ=WEEKLY;BYDAY=TU,TH", reminders: [30] },
    { key: "soccer", title: "Futebol com os amigos", start: [-60, "17:00"], end: [-60, "18:30"], category: "Lazer", location: "Quadra do Parque Ibirapuera", swatch: "grafite", rrule: "FREQ=WEEKLY;BYDAY=SA" },
    { key: "dentist", title: "Consulta com a Dra. Camila (dentista)", start: [0, "09:00"], end: [0, "10:00"], category: "Saúde", location: "Clínica Sorriso, Pinheiros", swatch: "lima", reminders: [60] },
    { key: "lunch", title: "Almoço com a Carol", start: [2, "12:30"], end: [2, "14:00"], category: "Pessoal", location: "Restaurante Dona Lucinha", swatch: "papel" },
    { key: "results", title: "Apresentação de resultados do 3º trimestre", start: [2, "14:00"], end: [2, "15:30"], category: "Trabalho", swatch: "tinta-verso", reminders: [30] },
    { key: "mom", title: "Aniversário da mãe", start: [5, "00:00"], end: [5, "23:59"], allDay: true, category: "Família", swatch: "lima", rrule: "FREQ=YEARLY", reminders: [1440] },
    { key: "cinema", title: "Cinema com a Bia", start: [4, "20:00"], end: [4, "22:30"], category: "Lazer", location: "Cinemark Shopping Eldorado", swatch: "papel" },
    { key: "school", title: "Reunião de pais na escola", start: [8, "18:30"], end: [8, "19:30"], category: "Família", location: "Colégio Santa Clara", swatch: "grafite", reminders: [60] },
    { key: "now", title: "Foco no relatório (em andamento)", start: [0, "00:00"], end: [0, "00:00"], startsAt: new Date(now.getTime() - 30 * 60_000).toISOString(), endsAt: new Date(now.getTime() + 60 * 60_000).toISOString(), category: "Trabalho", swatch: "lima-verso", reminders: [5, 30] },
    { key: "past1", title: "Café com a Júlia", start: [-9, "16:00"], end: [-9, "17:00"], category: "Pessoal", swatch: "papel" },
    { key: "past2", title: "Dentista — limpeza", start: [-5, "08:30"], end: [-5, "09:15"], category: "Saúde", location: "Clínica Sorriso, Pinheiros", swatch: "lima" },
    { key: "mon1", title: "Planejamento do trimestre", start: [6, "09:00"], end: [6, "11:00"], category: "Trabalho", swatch: "tinta-verso", reminders: [60] },
    { key: "mon2", title: "Jantar de aniversário da Carol", start: [10, "20:00"], end: [10, "23:00"], category: "Pessoal", location: "Bar do Alemão", swatch: "lima" },
    { key: "mon3", title: "Corrida no parque", start: [11, "07:00"], end: [11, "08:00"], category: "Saúde", swatch: "grafite" },
    { key: "mon4", title: "Revisão com o contador", start: [15, "14:30"], end: [15, "15:30"], category: "Finanças", swatch: "neutro", reminders: [120] },
    { key: "mon5", title: "Feriado — folga", start: [18, "00:00"], end: [18, "23:59"], allDay: true, category: "Pessoal", swatch: "papel" },
    { key: "mon6", title: "Workshop de fotografia", start: [22, "09:00"], end: [22, "17:00"], category: "Estudos", location: "Estúdio Luz", swatch: "lima-verso" },
    { key: "money", title: "Revisão do plano financeiro do mês", start: [-60, "21:00"], end: [-60, "21:30"], category: "Finanças", swatch: "neutro", rrule: "FREQ=MONTHLY" },
  ]
  for (const e of events) {
    add("events", { id: id("events", e.key), title: e.title, starts_at: e.startsAt ?? at(...e.start), ends_at: e.endsAt ?? at(...e.end), all_day: e.allDay ?? false, description: null, location: e.location ?? null, category: e.category, swatch: e.swatch, rrule: e.rrule ?? null, reminder_offsets: e.reminders ?? [] })
  }

  // ------------------------------------------------------------------------------------------------ Finanças
  const accounts = [
    { key: "nubank", name: "Conta Nubank", institution: "Nubank", opening: 1_500_000 },
    { key: "itau", name: "Conta corrente Itaú", institution: "Itaú", opening: 350_000 },
    { key: "cash", name: "Carteira", institution: "Dinheiro", opening: 250_000 },
  ]
  for (const a of accounts) add("finance_accounts", { id: id("finance_accounts", a.key), name: a.name, institution: a.institution, opening_balance_cents: a.opening })
  const A = (key: string) => id("finance_accounts", key)
  const templates: { d: number; kind: string; cents: number; desc: string; cat: string; acc: string; method: string }[] = [
    { d: 5, kind: "in", cents: 780_000, desc: "Salário — Empresa Alfa Ltda.", cat: "Salário", acc: "itau", method: "Transferência" },
    { d: 8, kind: "out", cents: 195_000, desc: "Aluguel", cat: "Moradia", acc: "itau", method: "Boleto" },
    { d: 8, kind: "out", cents: 48_000, desc: "Condomínio", cat: "Moradia", acc: "itau", method: "Boleto" },
    { d: 12, kind: "out", cents: 14_200, desc: "Conta de luz — Enel", cat: "Moradia", acc: "nubank", method: "Débito automático" },
    { d: 15, kind: "out", cents: 11_990, desc: "Internet — Vivo Fibra", cat: "Moradia", acc: "nubank", method: "Débito automático" },
    { d: 3, kind: "out", cents: 5_590, desc: "Netflix", cat: "Assinaturas", acc: "nubank", method: "Cartão" },
    { d: 6, kind: "out", cents: 2_190, desc: "Spotify", cat: "Assinaturas", acc: "nubank", method: "Cartão" },
    { d: 10, kind: "out", cents: 3_990, desc: "Amazon Prime", cat: "Assinaturas", acc: "nubank", method: "Cartão" },
    { d: 2, kind: "out", cents: 28_450, desc: "Supermercado Pão de Açúcar", cat: "Mercado", acc: "nubank", method: "Cartão" },
    { d: 9, kind: "out", cents: 31_870, desc: "Atacadão — compras do mês", cat: "Mercado", acc: "nubank", method: "Cartão" },
    { d: 16, kind: "out", cents: 19_640, desc: "Hortifruti da esquina", cat: "Mercado", acc: "cash", method: "Dinheiro" },
    { d: 23, kind: "out", cents: 27_300, desc: "Supermercado Extra", cat: "Mercado", acc: "nubank", method: "Cartão" },
    { d: 4, kind: "out", cents: 8_900, desc: "Almoço — Restaurante Dona Lucinha", cat: "Restaurantes", acc: "nubank", method: "Cartão" },
    { d: 11, kind: "out", cents: 12_750, desc: "Jantar — Outback", cat: "Restaurantes", acc: "nubank", method: "Cartão" },
    { d: 19, kind: "out", cents: 5_600, desc: "iFood — pizza de sexta", cat: "Restaurantes", acc: "nubank", method: "Cartão" },
    { d: 7, kind: "out", cents: 4_820, desc: "Uber — casa ao trabalho", cat: "Transporte", acc: "nubank", method: "Cartão" },
    { d: 14, kind: "out", cents: 18_000, desc: "Combustível — Posto Shell", cat: "Transporte", acc: "itau", method: "Débito" },
    { d: 21, kind: "out", cents: 7_500, desc: "Estacionamento mensal", cat: "Transporte", acc: "cash", method: "Dinheiro" },
    { d: 13, kind: "out", cents: 12_900, desc: "Farmácia Drogasil", cat: "Saúde", acc: "nubank", method: "Cartão" },
    { d: 17, kind: "out", cents: 8_000, desc: "Cinema + pipoca", cat: "Lazer", acc: "nubank", method: "Cartão" },
    { d: 22, kind: "out", cents: 15_000, desc: "Show — ingressos", cat: "Lazer", acc: "nubank", method: "Cartão" },
    { d: 1, kind: "out", cents: 45_000, desc: "Mensalidade da pós-graduação", cat: "Educação", acc: "itau", method: "Boleto" },
    { d: 20, kind: "in", cents: 120_000, desc: "Freelance — identidade visual", cat: "Renda extra", acc: "nubank", method: "Pix" },
    { d: 18, kind: "out", cents: 9_800, desc: "Presente de aniversário da Carol", cat: "Outros", acc: "cash", method: "Dinheiro" },
    { d: 1, kind: "out", cents: 22_300, desc: "Consulta com especialista", cat: "Saúde", acc: "itau", method: "Pix" },
    { d: 25, kind: "out", cents: 24_900, desc: "Curso de fotografia — parcela", cat: "Educação", acc: "nubank", method: "Cartão" },
  ]
  const today = day(0)
  const [thisYear, thisMonth] = today.split("-").map(Number)
  for (let back = 5; back >= 0; back--) {
    const month = new Date(Date.UTC(thisYear, thisMonth - 1 - back, 1))
    const ym = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`
    templates.forEach((t, index) => {
      if (t.cat === "Renda extra" && back % 2 === 1) return
      const date = `${ym}-${String(t.d).padStart(2, "0")}`
      if (date > today) return
      const drift = t.kind === "out" && t.cat !== "Moradia" ? 1 + (((back * 7 + index * 3) % 9) - 4) / 50 : 1
      add("finance_transactions", {
        id: id("finance_transactions", `${back}:${index}`),
        account_id: A(t.acc),
        category_id: category(t.cat),
        kind: t.kind,
        amount_cents: Math.round((t.cents * drift) / 10) * 10,
        occurred_on: date,
        method: t.method,
        description: t.desc,
        source: "manual",
      })
    })
  }
  const monthNow = today.slice(0, 7)
  const monthPrev = (() => {
    const d = new Date(Date.UTC(thisYear, thisMonth - 2, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  })()
  // Bills in every state, relative to today (due days are 1-28): paid, due today, overdue and upcoming.
  const dayOfMonth = Number(today.slice(8))
  const dueToday = Math.min(28, dayOfMonth)
  const overdueDay = Math.max(1, Math.min(28, dayOfMonth - 4))
  const upcomingDay = Math.min(28, dayOfMonth + 6)
  const bills: [string, string, number, number, string, boolean][] = [
    ["rent", "Aluguel", 195_000, 8, "Moradia", true],
    ["condo", "Condomínio", 48_000, 8, "Moradia", true],
    ["internet", "Internet — Vivo Fibra", 11_990, overdueDay, "Moradia", false],
    ["power", "Conta de luz — Enel", 14_200, 12, "Moradia", true],
    ["netflix", "Netflix", 5_590, 3, "Assinaturas", true],
    ["spotify", "Spotify", 2_190, 6, "Assinaturas", true],
    ["gym", "Academia Smart Fit", 12_990, dueToday, "Saúde", false],
    ["health", "Plano de saúde Unimed", 68_000, upcomingDay, "Saúde", false],
    ["college", "Mensalidade da pós", 45_000, 1, "Educação", true],
  ]
  for (const [key, name, cents, dueDay, cat, paid] of bills) add("finance_bills", { id: id("finance_bills", key), name, amount_cents: cents, due_day: dueDay, category_id: category(cat), active: true, last_paid_month: paid ? monthNow : monthPrev })
  add(
    "finance_goals",
    { id: id("finance_goals", "reserve"), name: "Reserva de emergência", target_cents: 2_000_000, current_cents: 1_240_000, deadline: `${thisYear + 1}-06-30` },
    { id: id("finance_goals", "trip"), name: "Viagem para Florianópolis", target_cents: 600_000, current_cents: 320_000, deadline: `${thisYear}-12-15` },
    { id: id("finance_goals", "notebook"), name: "Notebook novo", target_cents: 550_000, current_cents: 210_000, deadline: `${thisYear + 1}-03-31` },
    { id: id("finance_goals", "phone"), name: "Troca do celular", target_cents: 300_000, current_cents: 300_000, deadline: null }
  )

  // ------------------------------------------------------------------------------------------------ Treinos
  const ex = (name: string) => refs.exercises[name] ?? null
  const plans = [
    { key: "A", name: "Treino A — Peito e tríceps", weekdays: [1, 4], items: [["Supino reto com barra", 4, 8, 90, 70], ["Supino inclinado com halteres", 3, 10, 75, 26], ["Crucifixo na máquina", 3, 12, 60, 40], ["Tríceps na polia", 3, 12, 60, 30], ["Tríceps testa", 3, 10, 60, 25]] },
    { key: "B", name: "Treino B — Costas e bíceps", weekdays: [2, 5], items: [["Puxada frontal", 4, 10, 75, 55], ["Remada curvada", 4, 8, 90, 50], ["Remada baixa", 3, 12, 60, 45], ["Rosca direta", 3, 10, 60, 20], ["Rosca martelo", 3, 12, 45, 14]] },
    { key: "C", name: "Treino C — Pernas", weekdays: [3], items: [["Agachamento livre", 4, 8, 120, 80], ["Leg press 45°", 4, 12, 90, 160], ["Cadeira extensora", 3, 12, 60, 50], ["Mesa flexora", 3, 12, 60, 40], ["Panturrilha em pé", 4, 15, 45, 60]] },
  ] as const
  for (const p of plans) {
    add("workout_plans", { id: id("workout_plans", p.key), name: p.name, weekdays: [...p.weekdays] })
    p.items.forEach(([name, sets, reps, rest, load], position) => add("plan_exercises", { id: id("plan_exercises", `${p.key}:${position}`), plan_id: id("workout_plans", p.key), exercise_id: ex(name), position: position + 1, sets, reps, rest_seconds: rest, target_load_kg: load }))
  }
  for (let back = 70; back >= 1; back--) {
    for (const p of plans) {
      if (!(p.weekdays as readonly number[]).includes(weekday(-back))) continue
      if ((back * 5 + p.key.charCodeAt(0)) % 9 === 0) continue // a few skipped sessions (never every one of a plan: that depends on the plan, not the weekday)
      const sessionId = id("workout_sessions", `${p.key}:${back}`)
      add("workout_sessions", { id: sessionId, plan_id: id("workout_plans", p.key), performed_on: day(-back), duration_min: 55 + ((back * 3) % 15), completed: true })
      const weeksIn = Math.floor((70 - back) / 7)
      p.items.forEach(([name, sets, reps, , load], position) => {
        for (let s = 1; s <= sets; s++) add("set_logs", { id: id("set_logs", `${p.key}:${back}:${position}:${s}`), session_id: sessionId, exercise_id: ex(name), set_index: s, reps: s === sets ? reps - 1 : reps, load_kg: Math.round((load * (0.85 + weeksIn * 0.02)) / 2.5) * 2.5 })
      })
    }
  }

  // ------------------------------------------------------------------------------------------------ Dieta
  const food = (name: string) => refs.foods[name] ?? null
  const todayMeals: [string, string, number][] = [
    ["breakfast", "Pão francês", 1], ["breakfast", "Ovo cozido", 2], ["breakfast", "Café com leite", 1],
    ["lunch", "Arroz branco cozido", 2], ["lunch", "Feijão carioca cozido", 1.5], ["lunch", "Peito de frango grelhado", 1.5], ["lunch", "Salada de alface e tomate", 1], ["lunch", "Azeite de oliva", 0.5],
    ["snack", "Banana prata", 1], ["snack", "Iogurte natural", 1],
    ["dinner", "Macarrão cozido", 2], ["dinner", "Carne moída refogada", 1],
  ]
  todayMeals.forEach(([meal, name, servings], i) => add("meal_items", { id: id("meal_items", `today:${i}`), log_date: day(0), meal, food_id: food(name), servings }))
  // The two weeks before: three meals a day, varying a little, so the calories chart and the averages have something to show.
  for (let back = 1; back <= 14; back++) {
    const wobble = ((back * 37) % 11) - 5
    ;([["breakfast", "Pão francês", 1 + (wobble > 2 ? 1 : 0)], ["lunch", "Arroz branco cozido", 2 + (wobble > 0 ? 0.5 : 0)], ["lunch", "Peito de frango grelhado", 1.5], ["lunch", "Feijão carioca cozido", 1.5], ["snack", "Banana prata", 1], ["dinner", "Macarrão cozido", 2 + (wobble < 0 ? 0.5 : 0)], ["dinner", "Carne moída refogada", 1]] as [string, string, number][]).forEach(([meal, name, servings], i) =>
      add("meal_items", { id: id("meal_items", `${back}:${i}`), log_date: day(-back), meal, food_id: food(name), servings })
    )
  }
  add("water_logs", { id: id("water_logs", "today:0"), log_date: day(0), ml: 750 }, { id: id("water_logs", "today:1"), log_date: day(0), ml: 500 })
  for (let back = 1; back <= 14; back++) add("water_logs", { id: id("water_logs", `${back}:0`), log_date: day(-back), ml: 1500 + ((back * 53) % 9) * 120 })
  for (let i = 0; i < 12; i++) add("weight_logs", { id: id("weight_logs", String(i)), log_date: day(-(11 - i) * 7), weight_kg: Math.round((82.4 - i * 0.22 + (i % 3 === 1 ? 0.3 : 0)) * 10) / 10 })

  // ------------------------------------------------------------------------------------------------ Estudos
  const subjects: [string, string, string, string, string, number, number | null, string | null][] = [
    ["const", "Direito Constitucional", "subject", "high", "tinta-verso", 360, null, null],
    ["stats", "Estatística", "subject", "medium", "lima-verso", 240, null, null],
    ["method", "Metodologia Científica", "subject", "medium", "papel", 120, null, null],
    ["english", "Inglês — Intermediário", "course", "medium", "lima", 210, 62, "Módulo 8 de 13"],
    ["sapiens", "Sapiens — Yuval Noah Harari", "book", "low", "grafite", 90, 45, "pág. 210 de 464"],
    ["oab", "OAB — 1ª fase", "exam", "high", "tinta-verso", 300, 38, "Edital: 38% revisado"],
  ]
  for (const [key, name, type, priority, swatch, goal, pct, label] of subjects) add("subjects", { id: id("subjects", key), name, type, priority, swatch, weekly_goal_min: goal, progress_pct: pct, progress_label: label })
  subjects.forEach(([key], index) => {
    for (let back = 0; back < 60; back++) {
      const studies = (weekday(-back) + index) % 7 < 4 && (back * 3 + index) % 5 !== 0
      if (!studies) continue
      const minutes = [25, 50, 75, 90, 45, 60][(back + index * 2) % 6]
      add("study_sessions", { id: id("study_sessions", `${key}:${back}`), subject_id: id("subjects", key), studied_on: day(-back), minutes, mode: minutes % 25 === 0 ? "pomodoro" : "free" })
    }
  })
  const deadlines: [string, string | null, string, number, string][] = [
    ["oab", "oab", "OAB — 1ª fase (Exame Unificado)", 42, "exam"],
    ["stats", "stats", "Prova de Estatística — unidade 2", 9, "exam"],
    ["paper", "method", "Entrega do artigo de Metodologia", 9, "delivery"],
    ["english", "english", "Teste de nível do curso de inglês", 21, "exam"],
  ]
  for (const [key, subject, title, offset, kind] of deadlines) add("study_deadlines", { id: id("study_deadlines", key), subject_id: subject ? id("subjects", subject) : null, title, due_on: day(offset), kind })
  add(
    "flashcard_decks",
    { id: id("flashcard_decks", "const"), subject_id: id("subjects", "const"), name: "Constitucional — princípios fundamentais" },
    { id: id("flashcard_decks", "english"), subject_id: id("subjects", "english"), name: "Inglês — phrasal verbs" }
  )
  const cards: [string, string, string, number, number][] = [
    ["const", "Quais são os fundamentos da República (art. 1º da CF)?", "Soberania, cidadania, dignidade da pessoa humana, valores sociais do trabalho e da livre iniciativa e pluralismo político.", -1, 1],
    ["const", "Quantos são os Poderes da União e quais são?", "Três, independentes e harmônicos entre si: Legislativo, Executivo e Judiciário.", 0, 0],
    ["const", "O que diz o princípio da legalidade (art. 5º, II)?", "Ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei.", 0, 2],
    ["const", "Qual a diferença entre direitos e garantias fundamentais?", "Direitos declaram bens da vida; garantias são instrumentos para assegurá-los.", 4, 3],
    ["const", "Qual o prazo do mandato do Presidente da República?", "Quatro anos, com possibilidade de uma reeleição para o período subsequente.", 6, 3],
    ["english", "give up", "desistir — “I will never give up on my dreams.”", 0, 0],
    ["english", "look forward to", "aguardar com expectativa — “I look forward to meeting you.”", 0, 1],
    ["english", "come across", "encontrar por acaso — “I came across an old photo yesterday.”", -2, 1],
    ["english", "run out of", "ficar sem, acabar — “We ran out of coffee.”", 5, 3],
    ["english", "figure out", "descobrir, entender — “I can’t figure out this puzzle.”", 3, 2],
  ]
  cards.forEach(([deck, front, back, due, reps], i) => add("flashcards", { id: id("flashcards", String(i)), deck_id: id("flashcard_decks", deck), front, back, ease: 2.5, interval_days: reps === 0 ? 0 : reps * 3, repetitions: reps, due_on: day(due) }))

  // ------------------------------------------------------------------------------------------------ Notas e lembretes
  const folders: [string, string][] = [["work", "Trabalho"], ["study", "Estudos"], ["personal", "Pessoal"], ["ideas", "Ideias"]]
  for (const [key, name] of folders) add("note_folders", { id: id("note_folders", key), name })
  const notes: [string, string | null, string, string, boolean, string[]][] = [
    ["ata", "work", "Ata — alinhamento semanal", "# Alinhamento semanal\n\n**Participantes:** Marina, Rafael, Júlia e eu.\n\n## Decisões\n- Fechar a proposta da Almeida & Filhos até quinta\n- Rafael assume o relatório de custos do 3º trimestre\n- Nova rotina: *daily* de 10 minutos às 9h30\n\n## Próximos passos\n- Enviar o relatório semanal à Marina\n- Agendar entrevista da vaga de analista", true, ["reunião", "time"]],
    ["shopping", "personal", "Lista de compras do mês", "## Mercado\n- Arroz, feijão e macarrão\n- Frango e ovos\n- Frutas: banana, maçã e mamão\n- Café e leite\n\n## Casa\n- Detergente e esponjas\n- Lâmpada para a cozinha", false, ["casa"]],
    ["const", "study", "Resumo — Direito Constitucional", "# Princípios fundamentais\n\nOs **fundamentos da República** estão no art. 1º: soberania, cidadania, dignidade da pessoa humana, valores sociais do trabalho e da livre iniciativa e pluralismo político.\n\n## Poderes da União\n- Legislativo\n- Executivo\n- Judiciário\n\n*Revisar o capítulo sobre controle de constitucionalidade antes da prova.*", true, ["oab", "revisão"]],
    ["mom", "ideas", "Ideias para o aniversário da mãe", "# Aniversário da mãe\n\n- Almoço surpresa no sábado, na casa da tia Rosa\n- Álbum de fotos impresso\n- Bolo de cenoura com cobertura de chocolate (receita da vovó)\n\n**Orçamento:** até R$ 600,00", false, ["família"]],
    ["floripa", "personal", "Roteiro — Florianópolis", "# Florianópolis, dezembro\n\n## Hospedagem\n- Pousada na Lagoa da Conceição (R$ 280,00 a diária)\n\n## Passeios\n- Trilha da Lagoinha do Leste\n- Pôr do sol na Praia Mole\n- Jantar de frutos do mar no Ribeirão da Ilha\n\n*Comprar passagem até o fim do mês.*", false, ["viagem"]],
    ["blog", "ideas", "Ideias de conteúdo para o blog", "- Como organizei minha rotina de estudos em 4 semanas\n- 5 hábitos que mudaram meu ano\n- Planilha de gastos: o que aprendi\n- Treino em casa para quem tem pouco tempo", false, ["blog"]],
    ["close", "work", "Checklist de fechamento do mês", "## Financeiro\n- Conciliar notas fiscais\n- Enviar cobranças pendentes\n- Atualizar planilha de custos\n\n## Pessoas\n- Avaliar desempenho do time\n- Alinhar férias de dezembro", false, ["financeiro"]],
    ["quick", null, "Anotação rápida", "Ligar para o contador sobre o imposto de renda do ano passado.", false, []],
  ]
  notes.forEach(([key, folder, title, body, pinned, tags], i) => add("notes", { id: id("notes", key), folder_id: folder ? id("note_folders", folder) : null, title, body, pinned, tags, created_at: at(-i * 2 - 3, "09:00"), updated_at: at(-i * 2, "18:20") }))
  const reminders: [string, string, number, string, string[], string][] = [
    ["tax", "Ligar para o contador sobre o imposto de renda", 0, "15:00", ["push", "whatsapp"], "pending"],
    ["car", "Levar o carro para a revisão", 0, "17:30", ["whatsapp"], "pending"],
    ["college", "Pagar o boleto da faculdade", 1, "09:00", ["push", "whatsapp"], "pending"],
    ["gift", "Comprar presente da mãe", 3, "12:00", ["push"], "pending"],
    ["antivirus", "Renovar assinatura do antivírus", 8, "10:00", ["push"], "pending"],
    ["docs", "Enviar documentos ao contador", -1, "11:00", ["push"], "done"],
    ["rent", "Conferir o reajuste do aluguel", -2, "10:00", ["push"], "pending"],
  ]
  for (const [key, title, offset, time, channels, status] of reminders) add("reminders", { id: id("reminders", key), title, remind_at: at(offset, time), channels, status, note_id: null })

  // ------------------------------------------------------------------------------------------------ Metas
  const goals: { key: string; title: string; description: string; deadline: number | null; status: string; links: [string, string, number, number, string][]; milestones: [string, boolean][] }[] = [
    { key: "oab", title: "Passar na 1ª fase da OAB", description: "Estudar com constância até o exame e chegar na prova com todo o edital revisado.", deadline: 42, status: "active", links: [["estudos", "Horas de estudo", 0, 250, "h"], ["tarefas", "Tarefas concluídas", 0, 12, "tarefas"]], milestones: [["Fechar o edital de Direito Constitucional", true], ["Fazer 3 simulados completos", false], ["Revisar todos os erros dos simulados", false]] },
    { key: "reserve", title: "Juntar R$ 20.000 de reserva de emergência", description: "Seis meses de custo fixo guardados em investimento de liquidez diária.", deadline: 240, status: "active", links: [["financas", "Valor guardado", 0, 30000, "R$"], ["rotina", "Dias com o hábito em dia", 0, 90, "dias"]], milestones: [["Abrir conta em corretora", true], ["Configurar aporte automático", true], ["Chegar a R$ 15.000", false]] },
    { key: "run", title: "Correr 10 km sem parar", description: "Evoluir de 5 km para 10 km com treinos leves de corrida aos sábados.", deadline: 90, status: "active", links: [["treinos", "Treinos feitos", 0, 60, "treinos"]], milestones: [["Correr 5 km em menos de 30 minutos", true], ["Correr 8 km sem parar", false]] },
    { key: "books", title: "Ler 24 livros em 2026", description: "Dois livros por mês, alternando ficção e não ficção.", deadline: null, status: "active", links: [["rotina", "Dias com o hábito em dia", 0, 120, "dias"], ["dieta", "Dias dentro da meta", 0, 30, "dias"]], milestones: [] },
    { key: "photo", title: "Terminar o curso de fotografia", description: "Concluído com certificado no mês passado.", deadline: -30, status: "done", links: [["estudos", "Horas de estudo", 0, 12, "h"]], milestones: [["Entregar o projeto final", true]] },
  ]
  for (const g of goals) {
    add("life_goals", { id: id("life_goals", g.key), created_at: at(-90, "09:00"), title: g.title, description: g.description, deadline: g.deadline === null ? null : day(g.deadline), status: g.status })
    g.links.forEach(([module, label, done, total, unit], i) => add("life_goal_links", { id: id("life_goal_links", `${g.key}:${i}`), goal_id: id("life_goals", g.key), module, label, done, total, unit }))
    g.milestones.forEach(([title, done], i) => add("life_goal_milestones", { id: id("life_goal_milestones", `${g.key}:${i}`), goal_id: id("life_goals", g.key), title, done }))
  }

  // ------------------------------------------------------------------------------------------------ Diário
  const diary = [
    "Dia produtivo. Consegui fechar a proposta e ainda sobrou tempo para caminhar.",
    "Cansada. A reunião se estendeu e não consegui estudar.",
    "Almoço com a Carol foi ótimo, precisava desse respiro.",
    "Acordei sem energia, mas o treino ajudou a virar o dia.",
    "Dia corrido, muita coisa para resolver. Anotei tudo nas tarefas.",
    "Fim de semana tranquilo. Li bastante e dormi bem.",
    "Ansiosa com a prova de Estatística, mas revisei os flashcards.",
    "Dia leve. Cozinhei, assisti a um filme e fui dormir cedo.",
  ]
  for (let back = 60; back >= 1; back--) {
    const sleep = Math.round((5.2 + ((back * 7) % 11) * 0.35) * 2) / 2
    const trained = (back * 5) % 7 < 3
    const studied = ((back * 11) % 5) * 30
    const raw = 2.4 + (sleep >= 7 ? 1.2 : sleep >= 6 ? 0.5 : 0) + (trained ? 0.6 : 0) + (studied >= 60 ? 0.4 : 0) + (((back * 3) % 5) - 2) * 0.25
    const forced: Record<number, number> = { 4: 1, 9: 1, 13: 5, 20: 5, 27: 1 }
    add("journal_entries", { id: id("journal_entries", String(back)), entry_date: day(-back), mood: forced[back] ?? Math.max(1, Math.min(5, Math.round(raw))), text: back % 3 === 0 ? diary[back % diary.length] : "", sleep_hours: sleep })
  }

  // ------------------------------------------------------------------------------------------------ Notificações (o sino)
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()
  const notifications: [string, string, string, string | null, string | null, number, boolean][] = [
    ["bill", "bill", "Internet — Vivo Fibra venceu", "R$ 119,90 · confira em Finanças", "/dashboard/financas", 25, false],
    ["cards", "study", "Flashcards para revisar", "Direito Constitucional e inglês", "/dashboard/estudos", 95, false],
    ["workout", "workout", "Treino de hoje", "Veja o plano do dia", "/dashboard/treinos", 3 * 60, false],
    ["event", "agenda", "Consulta com a Dra. Camila", "Começa hoje às 9h, na Clínica Sorriso", "/dashboard/agenda", 5 * 60, true],
    ["task", "task", "Enviar relatório semanal à Marina", "Vence hoje às 17h", "/dashboard/tarefas", 8 * 60, true],
    ["habit", "habit", "Você está há 40 dias tomando a vitamina D", "Continue assim", "/dashboard/rotina", 26 * 60, true],
    ["goal", "goal", "Meta concluída: Troca do celular", "Parabéns, você chegou aos R$ 3.000,00", "/dashboard/financas", 2 * 24 * 60, true],
    ["reminder", "reminder", "Lembrete: conferir o reajuste do aluguel", null, "/dashboard/notas", 3 * 24 * 60, true],
    ["welcome", "info", "Bem-vindo ao Organizzou", "Esta conta tem dados de demonstração", null, 6 * 24 * 60, true],
  ]
  for (const [key, kind, title, body, link, minutes, read] of notifications) {
    add("notifications", { id: id("notifications", key), kind, title, body, link, read_at: read ? ago(minutes - 5) : null, created_at: ago(minutes) })
  }

  return DEMO_TABLES.map((table) => ({ table, rows: out[table] }))
}

/**
 * Monthly limits for the default categories, chosen from what was actually spent so far this month so the budget shows every state
 * on any day: the category with the most spending is over its limit, the next one is near it (about 90%), the others are comfortably under.
 * A category with nothing spent yet gets a plain fallback limit.
 */
export function categoryLimits(demo: Demo, refs: Refs, now: Date): Record<string, number> {
  const month = sp(now).slice(0, 7)
  const nameOf = new Map(Object.entries(refs.categories).map(([name, id]) => [id, name]))
  const spent = new Map<string, number>()
  for (const row of demo.find((t) => t.table === "finance_transactions")?.rows ?? []) {
    if (row.kind !== "out" || !String(row.occurred_on).startsWith(month)) continue
    const name = nameOf.get(row.category_id as string)
    if (name && name in DEMO_CATEGORY_LIMITS) spent.set(name, (spent.get(name) ?? 0) + Number(row.amount_cents))
  }
  const ranked = [...spent].sort((a, b) => b[1] - a[1])
  const limits: Record<string, number> = { ...DEMO_CATEGORY_LIMITS }
  ranked.forEach(([name, amount], index) => {
    const factor = index === 0 ? 0.8 : index === 1 ? 1 / 0.92 : 2.2
    limits[name] = Math.max(1000, Math.round((amount * factor) / 1000) * 1000)
  })
  return limits
}
