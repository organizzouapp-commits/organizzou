// The icon of a financial goal. An icon KEY is stored (never a component), so the set can grow without touching saved goals.
// localStorage adapter until `finance_goals.icon` (20261108000001) is applied; goals with no key use the piggy bank.

export const GOAL_ICON_KEYS = ["shield", "plane", "laptop", "phone", "home", "car", "heart", "graduation", "gift", "piggy"] as const
export type GoalIconKey = (typeof GOAL_ICON_KEYS)[number]

export const GOAL_ICON_LABELS: Record<GoalIconKey, string> = {
  shield: "Reserva",
  plane: "Viagem",
  laptop: "Computador",
  phone: "Celular",
  home: "Casa",
  car: "Carro",
  heart: "Saúde",
  graduation: "Estudos",
  gift: "Presente",
  piggy: "Cofrinho",
}

export const isGoalIcon = (value: unknown): value is GoalIconKey => typeof value === "string" && (GOAL_ICON_KEYS as readonly string[]).includes(value)

export type GoalIconRepo = {
  load(): Record<string, GoalIconKey>
  save(icons: Record<string, GoalIconKey>): void
}

const KEY = "organizzou:financas-goal-icons"

export const localGoalIconRepo: GoalIconRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>
      return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isGoalIcon(v))) as Record<string, GoalIconKey>
    } catch {
      return {}
    }
  },
  save(icons) {
    try {
      localStorage.setItem(KEY, JSON.stringify(icons))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  },
}
