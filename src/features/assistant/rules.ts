import type { ModuleId } from "@/components/organizzou/modules"
import { parseBRL } from "@/lib/money"

/**
 * The simple, rule-based reading of one line of text that quick capture uses to decide where it goes. There is no AI here: the
 * assistant proper is "Em breve". The same rules run in the browser (to show the destination) and on the server (to save it).
 */
const CATEGORY_HINTS: [RegExp, string][] = [
  [/mercado|supermercado|feira|padaria|hortifruti/i, "Mercado"],
  [/gasolina|combust[ií]vel|uber|99|estaciona|ônibus|onibus|metr[oô]/i, "Transporte"],
  [/restaurante|almo[cç]o|jantar|ifood|lanche|pizza|caf[eé]/i, "Restaurantes"],
  [/farm[aá]cia|rem[eé]dio|m[eé]dico|dentista|consulta/i, "Saúde"],
  [/cinema|show|bar|jogo|viagem|passeio/i, "Lazer"],
  [/netflix|spotify|assinatura|prime/i, "Assinaturas"],
  [/aluguel|condom[ií]nio|luz|internet|[aá]gua/i, "Moradia"],
]

/** Where a free-text capture should go. */
export function classifyCapture(text: string): ModuleId | null {
  const t = text.toLowerCase()
  if (!t.trim()) return null
  if (/gast(ei|o)|paguei|comprei|recebi|sal[aá]rio|r\$\s*\d/.test(t)) return "financas"
  if (/estudei|estudar|flashcard|prova|mat[eé]ria/.test(t)) return "estudos"
  if (/treino|treinei|s[eé]ries|academia|corrida/.test(t)) return "treinos"
  if (/almo[cç]ei|jantei|comi|caf[eé] da manh[ãa]|bebi \d|kcal|peso/.test(t)) return "dieta"
  if (/h[aá]bito|meditei|li \d|bebi [àa]gua/.test(t)) return "rotina"
  if (/reuni[ãa]o|consulta|marcar|evento|compromisso/.test(t)) return "agenda"
  if (/lembr(e|ar)|me avisa|anota|anotar|ideia/.test(t)) return "notas"
  if (/tarefa|fazer|entregar|enviar|ligar|pagar/.test(t)) return "tarefas"
  return null
}

export function guessCategory(text: string) {
  return CATEGORY_HINTS.find(([pattern]) => pattern.test(text))?.[1] ?? "Outros"
}

/** "gastei 45 no mercado" → { cents: 4500, what: "mercado" } */
export function parseExpense(text: string) {
  const match = text.match(/gast(?:ei|o)\s+(?:r\$\s*)?([\d.,]+)\s*(?:reais)?\s*(?:no|na|em|de|com|para)?\s*(.*)/i)
  if (!match) return null
  const cents = parseBRL(match[1])
  if (!cents) return null
  return { cents, what: match[2].trim().replace(/[.!?]+$/, "") || "gasto avulso" }
}
