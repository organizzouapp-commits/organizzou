/**
 * Plans, limits and entitlements: the single source of truth for "what can this person use". Pure (no I/O), so the server actions, the API
 * routes and the screens all ask the same functions. Client gating is only UX; every write is checked again on the server
 * (src/lib/plan-server.ts reads the profile, src/features/persist/gate.ts and the task actions enforce).
 */

export type PlanId = "free" | "pro"

/**
 * The launch price of the FIRST month of the monthly plan, in cents. The ONE place it is written: the server (checkout, "Cobrado hoje"), the
 * plan screen, the checkout, the locked screens and the docs all read it. Asaas refuses charges below R$ 5,00 (see MIN_CHARGE_CENTS in
 * src/lib/billing/pricing.ts), so this can never go lower than that.
 */
export const LAUNCH_PRICE_CENTS = 500

/** `null` = unlimited. */
export type PlanLimits = {
  /** Task boards ("quadros"). */
  boards: number | null
  /** Task lists (the columns of the boards), all boards together. */
  lists: number | null
  /** Assistant messages per day (in the app). 0 = no assistant. */
  assistantMessagesPerDay: number | null
}

export type PlanDefinition = {
  id: PlanId
  name: string
  tagline: string
  /** Prices in BRL cents. `firstMonthCents` is the launch price of the first month of the monthly plan. */
  price: { monthlyCents: number; yearlyCents: number; firstMonthCents: number }
  limits: PlanLimits
  features: string[]
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Plano Gratuito",
    tagline: "O essencial para organizar o dia.",
    price: { monthlyCents: 0, yearlyCents: 0, firstMonthCents: 0 },
    // The assistant is Pro only: no messages on Free.
    limits: { boards: 1, lists: 3, assistantMessagesPerDay: 0 },
    features: ["Tarefas com 1 quadro e até 3 listas", "Finanças com lançamentos manuais", "Lembretes de tarefas no celular"],
  },
  pro: {
    id: "pro",
    name: "Plano Pro",
    tagline: "Tudo liberado, o assistente à vontade.",
    price: { monthlyCents: 2490, yearlyCents: 25000, firstMonthCents: LAUNCH_PRICE_CENTS },
    limits: { boards: null, lists: null, assistantMessagesPerDay: 200 },
    features: [
      "Tudo do Plano Gratuito",
      "Quadros e listas ilimitados",
      "Finanças completas: contas fixas, parcelas, metas, orçamento e gráficos",
      "Assistente: conversa, ações e voz · 200 mensagens por dia",
      "Agenda, Rotina, Treinos, Dieta, Estudos, Notas, Metas, Diário e Cofre",
      "Todos os avisos e notificações",

    ],
  },
}

export type LimitKey = keyof PlanLimits

export const LIMIT_LABELS: Record<LimitKey, { singular: string; plural: string; hint: string }> = {
  boards: { singular: "quadro de tarefas", plural: "quadros de tarefas", hint: "Crie quantos quadros precisar" },
  lists: { singular: "lista de tarefas", plural: "listas de tarefas", hint: "Crie quantas listas precisar" },
  assistantMessagesPerDay: { singular: "mensagem por dia", plural: "mensagens por dia", hint: "Conversa, ações e voz com o assistente, até 200 mensagens por dia" },
}

// ---- features -----------------------------------------------------------------------------------------------------------------

export type Feature =
  | "financeRecurring" // fixed and installment bills
  | "financeGoals"
  | "financeBudget" // monthly limits per category
  | "financeCharts" // history and charts
  | "assistant"
  | "moduleAgenda"
  | "moduleRotina"
  | "moduleTreinos"
  | "moduleDieta"
  | "moduleEstudos"
  | "moduleNotas"
  | "moduleMetas"
  | "moduleDiario"
  | "moduleCofre"
  | "allNotifications"

export const PRO_FEATURES: readonly Feature[] = ["financeRecurring", "financeGoals", "financeBudget", "financeCharts", "assistant", "moduleAgenda", "moduleRotina", "moduleTreinos", "moduleDieta", "moduleEstudos", "moduleNotas", "moduleMetas", "moduleDiario", "moduleCofre", "allNotifications"]

/** Module names for the locked-module screen. */
export const MODULE_LABELS: Partial<Record<Feature, string>> = {
  moduleAgenda: "Agenda",
  moduleRotina: "Rotina",
  moduleTreinos: "Treinos",
  moduleDieta: "Dieta",
  moduleEstudos: "Estudos",
  moduleNotas: "Notas",
  moduleMetas: "Metas",
  moduleDiario: "Diário",
  moduleCofre: "Cofre",
}

// ---- who is Pro ---------------------------------------------------------------------------------------------------------------

/** A failed renewal keeps Pro working for this many days. */
export const GRACE_DAYS = 3

/** What is known about the person's plan. All fields optional: absence is the Free plan. */
export type PlanProfile = {
  plan?: unknown
  /** profiles.plan_until: when the paid (or courtesy) period ends. Null = no end. */
  planUntil?: string | null
  /** subscriptions.grace_until: set when a renewal failed. */
  graceUntil?: string | null
  isAdmin?: boolean
}

export type Entitlements = {
  plan: PlanId
  pro: boolean
  /** Pro only because of the grace period after a failed renewal. */
  inGrace: boolean
  limits: PlanLimits
  canUse: (feature: Feature) => boolean
  limit: (name: LimitKey) => number | null
}

const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : Number.NaN)

/** Pro when: an admin, or plan = 'pro' and no end date or an end date in the future, or inside the grace period of a failed renewal. */
export function getEntitlements(profile: PlanProfile | null | undefined, now: Date = new Date()): Entitlements {
  const at = now.getTime()
  const wantsPro = profile?.plan === "pro"
  const until = time(profile?.planUntil)
  const paid = wantsPro && (Number.isNaN(until) || until > at)
  const grace = time(profile?.graceUntil)
  const inGrace = wantsPro && !paid && !Number.isNaN(grace) && grace > at
  const pro = Boolean(profile?.isAdmin) || paid || inGrace
  const plan: PlanId = pro ? "pro" : "free"
  const limits = PLANS[plan].limits
  return {
    plan,
    pro,
    inGrace: inGrace && !profile?.isAdmin,
    limits,
    canUse: (feature) => pro || !PRO_FEATURES.includes(feature),
    limit: (name) => limits[name],
  }
}

/** The same rules for a plain plan id (when the dates were already applied). */
export const canUse = (plan: PlanId, feature: Feature): boolean => plan === "pro" || !PRO_FEATURES.includes(feature)
export const limit = (plan: PlanId, name: LimitKey): number | null => PLANS[plan].limits[name]

export function parsePlan(value: unknown): PlanId {
  return value === "pro" ? "pro" : "free"
}

export function isPro(plan: PlanId) {
  return plan === "pro"
}

/** The virtual assistant (chat) is a Pro feature. The chat route asks this; the UI only hides what the server would refuse. */
export function canUseAssistant(plan: PlanId) {
  return canUse(plan, "assistant")
}

/** True when `used` has reached the plan's limit for `key` (never for unlimited plans). */
export function reachedLimit(plan: PlanId, key: LimitKey, used: number) {
  const max = PLANS[plan].limits[key]
  return max !== null && used >= max
}
