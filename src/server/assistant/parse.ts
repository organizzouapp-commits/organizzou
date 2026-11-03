import { TZDate } from "@date-fns/tz"
import { format } from "date-fns"

import { parseBRL } from "@/lib/money"
import { dayOf, SP_TIMEZONE } from "@/lib/sp-time"

/**
 * The deterministic reader of quick capture: free text in, a list of things to create out. Cheap, offline and predictable; the model
 * is only asked when this is unsure. Pure (no server imports), so the screen runs it for the live "Vou criar:" preview and the
 * server runs the very same code to save, and both agree. Dates are resolved in America/Sao_Paulo.
 */

export const CAPTURE_TYPES = ["tarefa", "gasto", "receita", "nota", "habito", "evento", "lembrete", "meta", "humor", "agua", "peso", "sono", "treino", "estudo"] as const
export type CaptureType = (typeof CAPTURE_TYPES)[number]

export const TYPE_LABELS: Record<CaptureType, string> = {
  tarefa: "Tarefa",
  gasto: "Gasto",
  receita: "Receita",
  nota: "Nota",
  habito: "Hábito",
  evento: "Evento",
  lembrete: "Lembrete",
  meta: "Meta",
  humor: "Humor",
  agua: "Água",
  peso: "Peso",
  sono: "Sono",
  treino: "Treino",
  estudo: "Estudo",
}

/** Below this the reading is a guess: the text is kept as a note in the Inbox (and the person can convert it). */
export const CONFIDENCE_THRESHOLD = 0.6

export type CaptureItem = {
  type: CaptureType
  confidence: number
  /** The slice of the text this item came from. */
  source: string
  title: string
  /** yyyy-MM-dd in São Paulo. */
  day?: string
  /** HH:mm in São Paulo. */
  time?: string
  cents?: number
  category?: string
  priority?: "low" | "medium" | "high"
  /** Water in ml, weight in kg, sleep in hours, study/workout in minutes, mood 1-5. */
  amount?: number
  /** Study subject, workout plan or habit named in the text. */
  target?: string
}

const WEEKDAYS: [RegExp, number][] = [
  [/\bdomingo\b/, 0],
  [/\bsegunda(?:-feira)?\b/, 1],
  [/\bter[cç]a(?:-feira)?\b/, 2],
  [/\bquarta(?:-feira)?\b/, 3],
  [/\bquinta(?:-feira)?\b/, 4],
  [/\bsexta(?:-feira)?\b/, 5],
  [/\bs[aá]bado\b/, 6],
]

const spDate = (now: Date) => new TZDate(now.getTime(), SP_TIMEZONE)

/** "yyyy-MM-dd" for a São Paulo calendar date. */
const ymd = (year: number, month: number, day: number) => format(new TZDate(year, month, day, 12, 0, 0, SP_TIMEZONE), "yyyy-MM-dd")

type Found = { day?: string; time?: string; rest: string }

/** Pulls a date and a time out of the text ("sexta", "amanhã 15h", "dia 10", "25/12", "às 9h30") and returns what is left. */
export function extractWhen(input: string, now: Date): Found {
  let text = ` ${input} `
  let day: string | undefined
  let time: string | undefined
  const take = (pattern: RegExp, onMatch: (m: RegExpMatchArray) => void) => {
    const m = text.match(pattern)
    if (!m) return false
    onMatch(m)
    text = text.replace(pattern, " ")
    return true
  }
  const today = spDate(now)
  const lower = () => text.toLowerCase()

  // Time first: "15h", "15h30", "15:30", "às 9", "as 9h".
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  take(/(?<![\p{L}\d])(?:[àa]s\s+)?(\d{1,2})\s*(?:h|:)\s*(\d{2})?(?![\p{L}\d])(?!\s*(?:reais|r\$))/iu, (m) => {
    const hours = Number(m[1])
    const minutes = m[2] ? Number(m[2]) : 0
    if (hours <= 23 && minutes <= 59) time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  }) || take(/(?<![\p{L}\d])[àa]s\s+(\d{1,2})(?![\p{L}\d])(?!\s*(?:reais|r\$|kg|ml))/iu, (m) => {
    const hours = Number(m[1])
    if (hours <= 23) time = `${String(hours).padStart(2, "0")}:00`
  })

  if (take(/(?<![\p{L}])depois de amanh[ãa](?![\p{L}])/iu, () => (day = dayOf(now, 2)))) {
    // handled
  } else if (take(/(?<![\p{L}])amanh[ãa](?![\p{L}])/iu, () => (day = dayOf(now, 1)))) {
    // handled
  } else if (take(/\bhoje\b/i, () => (day = dayOf(now, 0)))) {
    // handled
  } else if (take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
    const d = Number(m[1])
    const mo = Number(m[2])
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return
    let year = m[3] ? Number(m[3]) : today.getFullYear()
    if (year < 100) year += 2000
    let candidate = ymd(year, mo - 1, d)
    if (!m[3] && candidate < dayOf(now, 0)) candidate = ymd(year + 1, mo - 1, d)
    day = candidate
  })) {
    // handled
  } else if (take(/\bdia\s+(\d{1,2})\b(?!\s*(?:de\s+)?(?:reais|r\$))/i, (m) => {
    const d = Number(m[1])
    if (d < 1 || d > 31) return
    let candidate = ymd(today.getFullYear(), today.getMonth(), d)
    if (candidate < dayOf(now, 0)) candidate = ymd(today.getFullYear(), today.getMonth() + 1, d)
    day = candidate
  })) {
    // handled
  } else {
    for (const [pattern, weekday] of WEEKDAYS) {
      if (pattern.test(lower())) {
        // The coming one; "sexta" said on a Friday means next Friday ("hoje" is how you say today).
        const ahead = ((weekday - today.getDay() + 7) % 7) || 7
        day = dayOf(now, ahead)
        text = text.replace(new RegExp(pattern.source, "i"), " ")
        break
      }
    }
  }

  // A part of the day without a clock time.
  if (!time) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    take(/(?<![\p{L}])(?:de|da|pela)\s+manh[ãa](?![\p{L}])/iu, () => (time = "09:00")) ||
      take(/\b(?:de|da|pela)\s+tarde\b/i, () => (time = "15:00")) ||
      take(/\b(?:de|da|pela)\s+noite\b/i, () => (time = "20:00"))
  }
  // A time with no date means today.
  if (time && !day) day = dayOf(now, 0)

  return { day, time, rest: text.replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1").trim() }
}

function priorityOf(text: string): { priority?: "low" | "medium" | "high"; rest: string } {
  if (/\b(urgente|prioridade alta|alta prioridade|importante)\b/i.test(text)) return { priority: "high", rest: text.replace(/\b(urgente|prioridade alta|alta prioridade|importante)\b/gi, " ") }
  if (/\b(prioridade m[eé]dia|m[eé]dia prioridade)\b/i.test(text)) return { priority: "medium", rest: text.replace(/\b(prioridade m[eé]dia|m[eé]dia prioridade)\b/gi, " ") }
  if (/\b(prioridade baixa|baixa prioridade|sem pressa)\b/i.test(text)) return { priority: "low", rest: text.replace(/\b(prioridade baixa|baixa prioridade|sem pressa)\b/gi, " ") }
  return { rest: text }
}

const CATEGORY_HINTS: [RegExp, string][] = [
  [/mercado|supermercado|feira|padaria|hortifruti/i, "Mercado"],
  [/gasolina|combust[ií]vel|uber|\b99\b|estaciona|[ôo]nibus|metr[oô]/i, "Transporte"],
  [/restaurante|almo[cç]o|jantar|ifood|lanche|pizza|caf[eé]/i, "Restaurantes"],
  [/farm[aá]cia|rem[eé]dio|m[eé]dico|dentista|consulta/i, "Saúde"],
  [/cinema|show|\bbar\b|jogo|viagem|passeio/i, "Lazer"],
  [/netflix|spotify|assinatura|prime/i, "Assinaturas"],
  [/aluguel|condom[ií]nio|\bluz\b|internet|[aá]gua da casa/i, "Moradia"],
]
export function guessCategory(text: string) {
  return CATEGORY_HINTS.find(([pattern]) => pattern.test(text))?.[1] ?? "Outros"
}

const cap = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text)
const clean = (text: string) => text.replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "").replace(/\s{2,}/g, " ")

/** The first money amount in the text, in cents ("R$ 45", "45,90 reais", "gastei 45"). */
function amountOf(text: string): { cents: number; rest: string } | null {
  const patterns = [/r\$\s*([\d.]+(?:,\d{1,2})?)/i, /([\d.]+(?:,\d{1,2})?)\s*(?:reais|real|conto|pila)/i, /(?:gast(?:ei|o)|paguei|comprei|recebi|ganhei|custou|custa)\s+(?:um total de\s+)?([\d.]+(?:,\d{1,2})?)\b/i]
  for (const pattern of patterns) {
    const m = text.match(pattern)
    if (!m) continue
    const cents = parseBRL(m[1])
    if (cents && cents > 0) return { cents, rest: text.replace(m[0], " ") }
  }
  return null
}

const INFINITIVE = /^(?:pagar|comprar|ligar|enviar|mandar|fazer|marcar|entregar|revisar|agendar|reservar|renovar|buscar|levar|trocar|limpar|organizar|resolver|escrever|terminar|preparar|cancelar|confirmar|visitar|consertar|emitir|declarar|responder|falar|chamar|ir|passar|pegar|devolver|checar|conferir|atualizar)\b/i

const MOOD_WORDS: [RegExp, number][] = [
  [/\b(p[eé]ssimo|horr[ií]vel|p[eé]ssima|muito mal|destru[ií]d[oa])\b/i, 1],
  [/\b(triste|mal|cansad[oa]|ansios[oa]|estressad[oa]|desanimad[oa]|chatead[oa])\b/i, 2],
  [/\b(normal|tranquil[oa]|ok|mais ou menos)\b/i, 3],
  [/\b(bem|animad[oa]|contente|satisfeit[oa])\b/i, 4],
  [/\b(feliz|[oó]timo|[oó]tima|incr[ií]vel|radiante|muito bem)\b/i, 5],
]

/** One piece of text (already one item) to a CaptureItem. Unsure readings come back as "nota" with a low confidence. */
export function readOne(source: string, now: Date): CaptureItem {
  const original = clean(source)
  const lower = original.toLowerCase()
  const base = { source: original }
  const note = (confidence: number): CaptureItem => ({ ...base, type: "nota", confidence, title: cap(clean(original.split("\n")[0]).slice(0, 80)) })

  if (!original) return note(0)

  // Water: "bebi 500 ml", "2 copos de água", "tomei 1,5 litro".
  const water = lower.match(/(\d+(?:[.,]\d+)?)\s*(ml|l|litros?|copos?)\b[^.]*?(?:[aá]gua)?/)
  if (/(?:bebi|tomei|beber|tomar)/.test(lower) && /[aá]gua|\bml\b|litro|copo/.test(lower) && water) {
    const n = Number(water[1].replace(",", "."))
    const ml = /^l/.test(water[2]) ? n * 1000 : /^copo/.test(water[2]) ? n * 250 : n
    if (ml > 0 && ml <= 5000) return { ...base, type: "agua", confidence: 0.92, title: `${Math.round(ml)} ml de água`, amount: Math.round(ml) }
  }

  // Weight: "pesei 72,4", "meu peso 72 kg".
  const weight = lower.match(/(?:pesei|peso(?:\s+(?:hoje|atual))?(?:\s+(?:é|foi|de))?)\s*:?\s*(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|quilos?)?/) ?? lower.match(/\b(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|quilos)\b/)
  if (weight && /pes[eo]|peso|kg|quilo/.test(lower) && !/comprei|gastei|r\$|reais/.test(lower)) {
    const kg = Number(weight[1].replace(",", "."))
    if (kg >= 20 && kg <= 400) return { ...base, type: "peso", confidence: 0.9, title: `${String(kg).replace(".", ",")} kg`, amount: kg, day: extractWhen(original, now).day }
  }

  // Sleep: "dormi 7 horas", "dormi 6h30".
  const sleep = lower.match(/dormi\s+(?:cerca de\s+|umas?\s+)?(\d{1,2})(?:\s*h(?:oras?)?\s*(\d{2})?|[.,](\d))?/)
  if (sleep) {
    const hours = Number(sleep[1]) + (sleep[2] ? Number(sleep[2]) / 60 : sleep[3] ? Number(sleep[3]) / 10 : 0)
    if (hours > 0 && hours <= 24) return { ...base, type: "sono", confidence: 0.9, title: `${String(Math.round(hours * 10) / 10).replace(".", ",")} h de sono`, amount: Math.round(hours * 10) / 10 }
  }

  // Mood: "humor 4", "humor 4/5", "estou feliz", "me sinto cansado".
  const moodNumber = lower.match(/\bhumor\s*(?:é|foi|:)?\s*([1-5])(?:\s*\/\s*5)?\b/)
  if (moodNumber) return { ...base, type: "humor", confidence: 0.92, title: `Humor ${moodNumber[1]} de 5`, amount: Number(moodNumber[1]) }
  if (/\b(?:me sinto|estou|t[oô]|hoje estou|sentindo)\b/.test(lower) || /\bhumor\b/.test(lower)) {
    const hit = MOOD_WORDS.find(([pattern]) => pattern.test(lower))
    if (hit) return { ...base, type: "humor", confidence: 0.75, title: `Humor ${hit[1]} de 5`, amount: hit[1], target: cap(clean(original)) }
  }

  // Study: "estudei 1 hora de estatística", "estudei estatística 45 min".
  if (/\bestud(?:ei|ando)\b/.test(lower)) {
    const hours = lower.match(/(\d+(?:[.,]\d+)?)\s*h(?:oras?)?(?:\s*e?\s*(\d{1,2})\s*min)?\b/)
    const minutes = lower.match(/(\d+)\s*min/)
    const total = hours ? Math.round(Number(hours[1].replace(",", ".")) * 60 + (hours[2] ? Number(hours[2]) : 0)) : minutes ? Number(minutes[1]) : 0
    const subject = clean(original.replace(/estud(?:ei|ando)/i, "").replace(/(\d+(?:[.,]\d+)?)\s*(?:h(?:oras?)?|min(?:utos?)?)\b(?:\s*e?\s*\d{1,2}\s*min)?/gi, "").replace(/\b(?:de|por|sobre|hoje|ontem)\b/gi, " "))
    if (total > 0) return { ...base, type: "estudo", confidence: 0.9, title: `${total} min de estudo${subject ? ` · ${subject}` : ""}`, amount: total, target: subject || undefined }
    return { ...base, type: "estudo", confidence: 0.5, title: cap(clean(original)) }
  }

  // Workout: "treinei peito 50 min", "fui à academia", "corri 5 km".
  if (/\b(treinei|treino de hoje|fui [àa] academia|corri|malhei|nadei|pedalei)\b/.test(lower)) {
    const minutes = lower.match(/(\d+)\s*min/)
    const hours = lower.match(/(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\b/)
    const total = minutes ? Number(minutes[1]) : hours ? Math.round(Number(hours[1].replace(",", ".")) * 60) : undefined
    const target = clean(original.replace(/\b(treinei|treino de hoje|fui [àa] academia|malhei|corri|nadei|pedalei)\b/gi, "").replace(/\d+\s*(?:min(?:utos?)?|h(?:oras?)?)\b/gi, "").replace(/\b(?:de|por|hoje)\b/gi, " "))
    return { ...base, type: "treino", confidence: 0.85, title: `Treino${target ? ` · ${target}` : ""}`, amount: total, target: target || undefined }
  }

  // Money: spent or received something.
  const money = amountOf(original)
  const received = /\b(recebi|ganhei|sal[aá]rio|entrou|pix recebido|rendimento)\b/i.test(lower)
  const spent = /\b(gast(?:ei|o)|paguei|comprei|custou|saiu|debitou|pagamento)\b/i.test(lower)
  if (money && (received || spent)) {
    const when = extractWhen(money.rest, now)
    const what = clean(when.rest.replace(/\b(gast(?:ei|o)|paguei|comprei|recebi|ganhei|custou|saiu|debitou)\b/gi, " ").replace(/^\s*(?:no|na|em|de|com|para|pelo|pela|do|da)\s+/i, " ").replace(/\b(?:reais|r\$)\b/gi, " "))
    const title = cap(clean(what.replace(/^(?:no|na|em|de|com|para|pelo|pela|do|da)\s+/i, "")) || (received ? "Receita avulsa" : "Gasto avulso"))
    return { ...base, type: received && !spent ? "receita" : "gasto", confidence: 0.92, title, cents: money.cents, day: when.day, category: received && !spent ? undefined : guessCategory(original) }
  }

  // Habit: "criar hábito de meditar", "todo dia ler 10 páginas", or logging an existing habit ("meditei").
  const habitCreate = original.match(/(?:criar\s+(?:um\s+)?h[aá]bito(?:\s+de)?|novo h[aá]bito(?:\s+de)?|h[aá]bito(?:\s+de)?|todo dia|todos os dias|diariamente)\s*:?\s*(.+)/i)
  if (habitCreate && clean(habitCreate[1])) return { ...base, type: "habito", confidence: 0.88, title: cap(clean(habitCreate[1])) }
  if (/\b(meditei|li \d+|li um pouco|fiz yoga|fiz alongamento)\b/.test(lower)) return { ...base, type: "habito", confidence: 0.7, title: cap(clean(original)), target: clean(original) }

  const when = extractWhen(original, now)
  const { priority, rest: afterPriority } = priorityOf(when.rest)
  const subject = clean(afterPriority)

  // Reminder.
  const reminder = subject.match(/^(?:me\s+)?(?:lembre?|lembrar|lembra|avisa|avise)(?:-me)?(?:\s+de|\s+para)?\s+(.+)/i) ?? subject.match(/^lembrete\s*:?\s*(.+)/i)
  if (reminder) return { ...base, type: "lembrete", confidence: 0.9, title: cap(clean(reminder[1])), day: when.day ?? dayOf(now, 0), time: when.time ?? (when.day ? "09:00" : undefined), priority }

  // Goal.
  const goal = subject.match(/^(?:minha\s+)?(?:nova\s+)?(?:meta|objetivo)\s*(?:de|:)?\s*(.+)/i) ?? subject.match(/^quero\s+((?:juntar|perder|ler|aprender|correr|economizar|guardar)\b.+)/i)
  if (goal) return { ...base, type: "meta", confidence: 0.85, title: cap(clean(goal[1])), day: when.day }

  // Note.
  const noteMatch = subject.match(/^(?:anota(?:r)?|nota|ideia)\s*:?\s*(?:que\s+)?(.+)/i)
  if (noteMatch) return { ...base, type: "nota", confidence: 0.9, title: cap(clean(noteMatch[1]).slice(0, 80)) }

  // Event: needs a clear event word AND a date, otherwise it is probably a task.
  const eventWord = /\b(reuni[ãa]o|consulta|evento|compromisso|anivers[aá]rio|jantar com|almo[cç]o com|encontro|show|palestra|aula|dentista|m[eé]dic[oa]|entrevista)\b/i
  if (eventWord.test(subject) && (when.day || when.time)) return { ...base, type: "evento", confidence: 0.85, title: cap(subject), day: when.day, time: when.time }

  // Task: starts with a verb in the infinitive, or says so.
  const taskMatch = subject.match(/^(?:tarefa|todo|preciso|tenho que|tenho de|n[ãa]o esquecer de|lembrar de)\s*:?\s*(?:de\s+)?(.+)/i)
  if (taskMatch) return { ...base, type: "tarefa", confidence: 0.9, title: cap(clean(taskMatch[1])), day: when.day, time: when.time, priority }
  if (INFINITIVE.test(subject)) return { ...base, type: "tarefa", confidence: 0.85, title: cap(subject), day: when.day, time: when.time, priority }
  if (eventWord.test(subject)) return { ...base, type: "tarefa", confidence: 0.62, title: cap(subject), day: when.day, time: when.time, priority }

  // A date or a verb-less line: not sure.
  if (when.day && subject.split(" ").length <= 6 && subject.length > 2) return { ...base, type: "tarefa", confidence: 0.6, title: cap(subject), day: when.day, time: when.time, priority }
  return note(0.3)
}

const VERBS =
  "pagar|comprar|ligar|enviar|mandar|fazer|marcar|entregar|revisar|agendar|reservar|renovar|buscar|levar|trocar|limpar|organizar|resolver|escrever|terminar|preparar|cancelar|confirmar|consertar|responder|falar|passar|pegar|devolver|gastei|paguei|comprei|recebi|bebi|tomei|dormi|pesei|estudei|treinei|meditei|anotar|lembrar|criar|ir"

/** "pagar aluguel sexta e comprar pão" -> two pieces. Splits on line breaks, ";", "+" and on " e " / "," when a new verb follows. */
export function splitItems(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\n|;|\s\+\s/)) {
    const parts = line.split(new RegExp(`\\s+e\\s+(?=(?:${VERBS})\\b)|,\\s*(?=(?:${VERBS})\\b)`, "i"))
    for (const part of parts) {
      const t = part.trim()
      if (t) out.push(t)
    }
  }
  return out
}

/** The whole text to items. Never empty for non-empty text: whatever is not understood becomes a low-confidence note. */
export function parseCapture(text: string, now: Date = new Date()): CaptureItem[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const pieces = splitItems(trimmed)
  const items = pieces.map((piece) => readOne(piece, now))
  // If splitting produced pieces that are all unsure, keep the whole text as one item (one Inbox note, nothing lost).
  if (items.length > 1 && items.every((item) => item.confidence < CONFIDENCE_THRESHOLD)) return [readOne(trimmed, now)]
  return items
}

export const isConfident = (item: CaptureItem) => item.confidence >= CONFIDENCE_THRESHOLD

/** "sexta, 15:00" style summary for a preview card or a toast. */
export function whenLabel(item: Pick<CaptureItem, "day" | "time">, now: Date = new Date()): string | null {
  if (!item.day && !item.time) return null
  const today = dayOf(now, 0)
  let dayText = ""
  if (item.day) {
    const diff = Math.round((Date.parse(`${item.day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000)
    if (diff === 0) dayText = "hoje"
    else if (diff === 1) dayText = "amanhã"
    else if (diff > 1 && diff < 7) dayText = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${item.day}T12:00:00Z`)).replace(/-feira$/, "")
    else dayText = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${item.day}T12:00:00Z`)).replace(/\./g, "")
  }
  return [dayText, item.time].filter(Boolean).join(" · ")
}

const firstNumber = (text: string) => {
  const m = text.match(/(\d+(?:[.,]\d+)?)/)
  return m ? Number(m[1].replace(",", ".")) : null
}

/**
 * Reads a text AS a given type ("Mudar tipo" in the preview, "Mudar para…" on an Inbox note). Returns null when the text cannot be
 * that type (a spending needs an amount, a mood needs a 1-5, ...); the caller says so honestly instead of guessing.
 */
export function readAs(type: CaptureType, text: string, now: Date = new Date()): CaptureItem | null {
  const source = clean(text)
  if (!source) return null
  const natural = readOne(source, now)
  if (natural.type === type && natural.confidence >= CONFIDENCE_THRESHOLD) return natural
  const when = extractWhen(source, now)
  const { priority, rest } = priorityOf(when.rest)
  const title = cap(clean(rest) || source).slice(0, 200)
  const base = { source, confidence: 1, title }
  switch (type) {
    case "tarefa":
      return { ...base, type, day: when.day, time: when.time, priority }
    case "evento":
      return { ...base, type, day: when.day ?? dayOf(now, 0), time: when.time }
    case "lembrete":
      return { ...base, type, day: when.day ?? dayOf(now, 0), time: when.time ?? "09:00" }
    case "nota":
      return { ...base, type, title: cap(clean(source.split("\n")[0]).slice(0, 80)) }
    case "meta":
      return { ...base, type, day: when.day }
    case "habito":
      return { ...base, type }
    case "gasto":
    case "receita": {
      const money = amountOf(source) ?? (firstNumber(source) ? { cents: parseBRL(String(firstNumber(source))) ?? 0, rest: source } : null)
      if (!money?.cents) return null
      const what = clean(extractWhen(money.rest, now).rest.replace(/\b(?:gast(?:ei|o)|paguei|comprei|recebi|ganhei)\b/gi, " ").replace(/^\s*(?:no|na|em|de|com|para)\s+/i, " ").replace(/\b(?:reais|r\$)\b/gi, " "))
      return { ...base, type, title: cap(what) || (type === "receita" ? "Receita avulsa" : "Gasto avulso"), cents: money.cents, day: when.day, category: type === "gasto" ? guessCategory(source) : undefined }
    }
    case "agua": {
      const n = firstNumber(source)
      if (!n) return null
      const ml = /\bl(?:itros?)?\b/i.test(source) ? n * 1000 : /copo/i.test(source) ? n * 250 : n
      return ml > 0 && ml <= 5000 ? { ...base, type, title: `${Math.round(ml)} ml de água`, amount: Math.round(ml) } : null
    }
    case "peso": {
      const n = firstNumber(source)
      return n && n >= 20 && n <= 400 ? { ...base, type, title: `${String(n).replace(".", ",")} kg`, amount: n, day: when.day } : null
    }
    case "sono": {
      const n = firstNumber(source)
      return n && n > 0 && n <= 24 ? { ...base, type, title: `${String(n).replace(".", ",")} h de sono`, amount: n } : null
    }
    case "humor": {
      const digit = source.match(/\b([1-5])\b/)
      const word = MOOD_WORDS.find(([pattern]) => pattern.test(source))
      const mood = digit ? Number(digit[1]) : word?.[1]
      return mood ? { ...base, type, title: `Humor ${mood} de 5`, amount: mood } : null
    }
    case "treino":
    case "estudo": {
      const hours = source.match(/(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\b/i)
      const minutes = source.match(/(\d+)\s*min/i)
      const total = minutes ? Number(minutes[1]) : hours ? Math.round(Number(hours[1].replace(",", ".")) * 60) : type === "treino" ? undefined : null
      if (total === null) return null
      return { ...base, type, title: type === "treino" ? "Treino" : `${total} min de estudo`, amount: total }
    }
  }
}
