// The Brazilian real mask, apart from the component: typing is cents-based (the digits typed are the cents), so 1234567 reads 12.345,67.
// Pure, so every edge (empty, zero, huge, paste, backspace) is tested.

/** More than this many digits is ignored: R$ 9.999.999.999.999,99 is far beyond any real use and still a safe integer. */
export const MAX_DIGITS = 15

/** 1234567 -> "12.345,67" (no currency symbol: the field draws the "R$" itself). */
export function formatMasked(cents: number): string {
  if (cents < 0) return `-${formatMasked(-cents)}`
  const safe = Math.round(cents)
  const whole = Math.floor(safe / 100).toLocaleString("pt-BR")
  const fraction = String(safe % 100).padStart(2, "0")
  return `${whole},${fraction}`
}

/** The cents the digits of a typed text stand for ("12.345,67" -> 1234567, "" -> null). */
export function centsFromTyped(text: string): number | null {
  const digits = text.replace(/\D/g, "").slice(0, MAX_DIGITS)
  return digits === "" ? null : Number(digits)
}

/**
 * What typing produced: the new cents, or null when the field was emptied. Deleting from a lone "0,00" clears the field instead of leaving
 * an unremovable zero behind.
 */
export function nextCentsFromTyping(previousText: string, typedText: string): number | null {
  const cents = centsFromTyped(typedText)
  if (cents === 0 && typedText.length < previousText.length) return null
  return cents
}

/**
 * Pasted text to cents. Accepts "1.234,56" (pt-BR), "1234.56" (dot decimal), "R$ 45", "1.234" (a dot with three digits after it is a
 * thousands separator), plain integers (reais) and ignores anything else. Negative amounts are not accepted. Null when there is no amount.
 */
export function parsePastedMoney(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, "")
  if (!/\d/.test(cleaned)) return null
  const hasComma = cleaned.includes(",")
  let normalized: string
  if (hasComma) normalized = cleaned.replace(/\./g, "").replace(",", ".")
  else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) normalized = cleaned.replace(/\./g, "")
  else normalized = cleaned
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  const cents = Math.round(value * 100)
  return cents > Number("9".repeat(MAX_DIGITS)) ? null : cents
}

/** Like `nextCentsFromTyping`, for fields that may hold a negative amount (an overdrawn account): a "-" in the text makes the amount negative. */
export function nextSignedCentsFromTyping(previousText: string, typedText: string): number | null {
  const cents = nextCentsFromTyping(previousText, typedText)
  if (cents === null || cents === 0) return cents
  return typedText.includes("-") ? -cents : cents
}
