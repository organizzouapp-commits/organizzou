/**
 * Plans and their limits. UI only for now: there is NO payment provider yet (docs/INTEGRATIONS-STATUS.md), so the plan of every
 * user is `free` until `profiles.plan` is set by hand/service role. Prices are placeholders the owner must fill in.
 */

export type PlanId = "free" | "pro"

/** `null` = unlimited. */
export type PlanLimits = {
  /** Task boards ("listas"). */
  taskBoards: number | null
  /** Assistant messages per day (in the app). */
  assistantMessagesPerDay: number | null
}

export type PlanDefinition = {
  id: PlanId
  name: string
  tagline: string
  /** Prices in BRL cents. TODO(owner): confirm the real prices before charging anyone. */
  price: { monthlyCents: number; yearlyCents: number }
  limits: PlanLimits
  features: string[]
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Plano Gratuito",
    tagline: "O essencial para organizar o dia.",
    // TODO(owner): free stays at zero.
    price: { monthlyCents: 0, yearlyCents: 0 },
    limits: { taskBoards: 3, assistantMessagesPerDay: 15 },
    features: [
      "Tarefas, rotina, agenda e notas",
      "Finanças com lançamentos manuais",
      "Até 3 listas de tarefas",
      "15 mensagens por dia com o assistente (só texto no app)",
    ],
  },
  pro: {
    id: "pro",
    name: "Plano Pro",
    tagline: "Sem limites, com o assistente à vontade.",
    // TODO(owner): placeholder prices, not final.
    price: { monthlyCents: 1990, yearlyCents: 19900 },
    limits: { taskBoards: null, assistantMessagesPerDay: 200 },
    features: [
      "Tudo do Plano Gratuito",
      "Listas de tarefas ilimitadas",
      "Assistente com 200 mensagens por dia",
      "Resumos e revisões semanais personalizados",
      "Suporte prioritário",
    ],
  },
}

export type LimitKey = keyof PlanLimits

export const LIMIT_LABELS: Record<LimitKey, { singular: string; plural: string; hint: string }> = {
  taskBoards: { singular: "lista de tarefas", plural: "listas de tarefas", hint: "Crie quantas listas precisar" },
  assistantMessagesPerDay: { singular: "mensagem por dia", plural: "mensagens por dia", hint: "Converse com o assistente até 200 vezes por dia" },
}

export function parsePlan(value: unknown): PlanId {
  return value === "pro" ? "pro" : "free"
}

export function isPro(plan: PlanId) {
  return plan === "pro"
}

/** True when `used` has reached the plan's limit for `key` (never for unlimited plans). */
export function reachedLimit(plan: PlanId, key: LimitKey, used: number) {
  const limit = PLANS[plan].limits[key]
  return limit !== null && used >= limit
}
