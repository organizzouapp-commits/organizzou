export type Strength = "weak" | "medium" | "strong"

export const STRENGTH_LABELS: Record<Strength, string> = { weak: "Fraca", medium: "Média", strong: "Forte" }

const COMMON = ["senha", "123456", "qwerty", "password", "abc123", "111111", "admin", "brasil", "futebol"]

/** Rough entropy in bits from length and the character classes in use. */
export function entropyBits(password: string) {
  if (!password) return 0
  let pool = 0
  if (/[a-z]/.test(password)) pool += 26
  if (/[A-Z]/.test(password)) pool += 26
  if (/\d/.test(password)) pool += 10
  if (/[^A-Za-z0-9]/.test(password)) pool += 32
  return Math.round(password.length * Math.log2(Math.max(pool, 2)))
}

export function passwordStrength(password: string): Strength {
  const lower = password.toLowerCase()
  if (password.length < 8 || COMMON.some((word) => lower.includes(word))) return "weak"
  const bits = entropyBits(password)
  if (bits < 50) return "weak"
  if (bits < 75) return "medium"
  return "strong"
}

/** Groups of item ids that share the same password. */
export function findReused(items: { id: string; password?: string }[]) {
  const byPassword = new Map<string, string[]>()
  for (const item of items) {
    if (!item.password) continue
    byPassword.set(item.password, [...(byPassword.get(item.password) ?? []), item.id])
  }
  return [...byPassword.values()].filter((ids) => ids.length > 1)
}

export type GeneratorOptions = { length: number; upper: boolean; lower: boolean; digits: boolean; symbols: boolean }

const SETS = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lower: "abcdefghijkmnpqrstuvwxyz",
  digits: "23456789",
  symbols: "!@#$%&*?-_+=",
}

/** Uses crypto.getRandomValues; guarantees one character from every enabled set. */
export function generatePassword(options: GeneratorOptions, random: (max: number) => number = secureRandom) {
  const pools = (Object.keys(SETS) as (keyof typeof SETS)[]).filter((key) => options[key]).map((key) => SETS[key])
  if (pools.length === 0) return ""
  const all = pools.join("")
  const chars = pools.map((pool) => pool[random(pool.length)])
  while (chars.length < options.length) chars.push(all[random(all.length)])
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = random(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.slice(0, options.length).join("")
}

function secureRandom(max: number) {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buffer = new Uint32Array(1)
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)
  return buffer[0] % max
}
