// The ONE place that says what the assistant costs. Update the numbers here when the provider changes its prices or when the model changes;
// nothing else in the app hard-codes a price. Everything computed from these is an ESTIMATE:
//   - the usage counters keep input and output tokens only (cache reads and cache writes are not tracked separately), so the estimate prices
//     every token at the full rate: it is an upper bound, the real invoice is lower when the prompt cache hits;
//   - the model is not stored per message, so one price applies to everything (the configured model).

export type AssistantPricing = {
  /** The model these prices are for (the default of ASSISTANT_MODEL). */
  model: string
  /** US$ per million INPUT tokens. */
  inputUsdPerMillion: number
  /** US$ per million OUTPUT tokens. */
  outputUsdPerMillion: number
}

export const ASSISTANT_PRICING: AssistantPricing = {
  model: "claude-haiku-5-5",
  inputUsdPerMillion: 0.1,
  outputUsdPerMillion: 0.5,
}

/** US$ 1 in reais, for the "estimativa" figures. A constant on purpose: change it here when the rate moves. */
export const USD_TO_BRL = 5.5

export const ESTIMATE_NOTE = "Estimativa: tokens de entrada e saída pelo preço cheio do modelo, sem desconto de cache (limite superior). Câmbio fixo de R$ 5,50 por US$ 1."

export type TokenCount = { input: number; output: number }

/** Estimated cost in US$ of some tokens. */
export function costUsd(tokens: TokenCount, pricing: AssistantPricing = ASSISTANT_PRICING): number {
  const input = Math.max(0, tokens.input) * pricing.inputUsdPerMillion
  const output = Math.max(0, tokens.output) * pricing.outputUsdPerMillion
  return (input + output) / 1_000_000
}

export const usdToBrl = (usd: number, rate: number = USD_TO_BRL): number => usd * rate

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const brlFine = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 })
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const usdFine = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 })

/** "R$ 0,0123" for fractions of a cent (the assistant is cheap), "R$ 12,34" otherwise. */
export const formatBrl = (value: number): string => (value > 0 && value < 0.01 ? brlFine : brl).format(value)
export const formatUsd = (value: number): string => (value > 0 && value < 0.01 ? usdFine : usd).format(value)
