// A habit has no icon column: the icon is derived from its name (keywords), so nothing new is stored.
export type HabitIconKey = "water" | "book" | "workout" | "walk" | "meditate" | "sleep" | "pill" | "study" | "stretch" | "food" | "write" | "default"

const RULES: [HabitIconKey, RegExp][] = [
  ["water", /\b(agua|beber|hidrat)/],
  ["book", /\b(ler|leitura|livro|paginas?)/],
  ["workout", /\b(treino|treinar|academia|muscula|exercicio|flexao|abdominal)/],
  ["walk", /\b(corr[ei]|corrida|caminh|andar|passos|pedal|bike)/],
  ["meditate", /\b(medit|respir|mindful|orar|oracao|gratidao)/],
  ["sleep", /\b(dormir|sono|acordar|deitar)/],
  ["pill", /\b(vitamina|remedio|medicament|suplement)/],
  ["study", /\b(estud|curso|aula|idioma|ingles|revisar)/],
  ["stretch", /\b(along|yoga|pilates|mobilidade)/],
  ["food", /\b(fruta|salada|dieta|comer|refeic|cafe da manha|jejum)/],
  ["write", /\b(escrev|diario|journal|anotar)/],
]

const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

export function habitIconKey(name: string): HabitIconKey {
  const text = plain(name)
  return RULES.find(([, rule]) => rule.test(text))?.[0] ?? "default"
}
