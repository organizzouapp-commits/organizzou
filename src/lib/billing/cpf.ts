/** CPF and CNPJ: digits only, validated by the check digits, masked for display. Never logged. */

export const onlyDigits = (value: string) => value.replace(/\D/g, "")

const allSame = (digits: string) => /^(\d)\1+$/.test(digits)

function checkDigit(base: string, weights: number[]) {
  const sum = base.split("").reduce((total, d, i) => total + Number(d) * weights[i], 0)
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 11 || allSame(d)) return false
  const first = checkDigit(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = checkDigit(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return first === Number(d[9]) && second === Number(d[10])
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 14 || allSame(d)) return false
  const first = checkDigit(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = checkDigit(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return first === Number(d[12]) && second === Number(d[13])
}

export const isValidCpfCnpj = (value: string) => isValidCpf(value) || isValidCnpj(value)

/** Masks while typing: 000.000.000-00 up to 11 digits, 00.000.000/0000-00 from 12 to 14. */
export function maskCpfCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2")
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}
