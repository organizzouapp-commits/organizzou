const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/** 123456 -> "R$ 1.234,56". Amounts are always integer cents. */
export function formatBRL(cents: number) {
  return brl.format(cents / 100).replace(/ /g, " ")
}

/** Signed amount with a real minus sign: "+ R$ 45,00" / "− R$ 45,00". */
export function formatSignedBRL(cents: number, kind: "in" | "out") {
  return `${kind === "in" ? "+" : "−"} ${formatBRL(Math.abs(cents))}`
}

/** "1.234,56", "45", "45,5" or "R$ 45,00" -> cents. Returns null when it is not a valid amount. */
export function parseBRL(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim()
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

/** Short form for chart axes: 1250000 -> "R$ 12,5 mil". */
export function formatCompactBRL(cents: number) {
  const reais = cents / 100
  if (Math.abs(reais) >= 1000) return `R$ ${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
  return `R$ ${reais.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
}
