import "server-only"

/**
 * A small typed client for the Asaas API v3 (https://docs.asaas.com). Server only: the API key (ASAAS_API_KEY) never reaches the browser.
 * Sandbox by default; production only with ASAAS_ENV=production. ASAAS_BASE_URL overrides the address.
 *
 * Nothing here logs a secret or personal data: a failure is logged as the operation, the HTTP status and Asaas's error CODES only
 * (never the description, which can echo what was sent) and the person gets a friendly pt-BR message.
 */

export type AsaasBillingType = "CREDIT_CARD" | "PIX" | "BOLETO" | "UNDEFINED"
export type AsaasCycle = "MONTHLY" | "YEARLY"

export type AsaasPayment = {
  id: string
  status: string
  value: number
  dueDate: string
  billingType?: string
  invoiceUrl?: string | null
  bankSlipUrl?: string | null
  subscription?: string | null
  paymentDate?: string | null
  confirmedDate?: string | null
  description?: string | null
  externalReference?: string | null
}
export type AsaasSubscription = { id: string; status: string; value: number; nextDueDate: string; cycle: AsaasCycle; billingType: AsaasBillingType; customer: string }
export type AsaasPixQrCode = { encodedImage: string; payload: string; expirationDate: string }

/** A failure with a message that is safe to show. */
import type { CustomerBody, SubscriptionBody } from "./payloads"

export class AsaasError extends Error {
  constructor(
    readonly userMessage: string,
    readonly status: number,
    readonly codes: string[] = []
  ) {
    super(userMessage)
    this.name = "AsaasError"
  }
}

const GENERIC = "O serviço de pagamento recusou o pedido. Confira os dados e tente de novo."
const BY_CODE: Record<string, string> = {
  invalid_cpfCnpj: "CPF ou CNPJ inválido. Confira os números e tente de novo.",
  invalid_customer: "Não consegui validar seus dados de cobrança. Confira o CPF ou CNPJ e o e-mail.",
  invalid_email: "E-mail inválido. Confira o e-mail da sua conta.",
  invalid_value: "O valor da cobrança não foi aceito. Tente de novo em instantes.",
  invalid_dueDate: "A data da cobrança não foi aceita. Tente de novo em instantes.",
}

/**
 * An Asaas validation message made safe to log: no e-mail, no CPF/CNPJ (formatted or as bare digits), no long token-like string,
 * single spaces, at most 200 characters. Asaas's own messages ("O campo X é inválido") hold no personal data, this is the belt to those braces.
 */
export function sanitizeDescription(text: unknown): string {
  return String(text ?? "")
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[documento]")
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "[documento]")
    .replace(/\b\d{14}\b|\b\d{11}\b/g, "[documento]")
    .replace(/[A-Za-z0-9_$-]{24,}/g, "[token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
}

/** A more specific message when Asaas's own description says what is wrong with the person's data. Null when it says nothing we can act on. */
export function specificMessage(descriptions: string[]): string | null {
  const text = descriptions.join(" ").toLowerCase()
  if (/cpf|cnpj/.test(text)) return "CPF ou CNPJ inválido. Confira os números e tente de novo."
  if (/e-?mail/.test(text)) return "E-mail inválido. Confira o e-mail da sua conta."
  if (/\bnome\b|\bname\b/.test(text)) return "O nome da conta está incompleto. Complete seu nome no perfil e tente de novo."
  return null
}

/** The friendly message for a failed response. Pure. */
export function messageFor(status: number, codes: string[], descriptions: string[] = []): string {
  for (const code of codes) if (BY_CODE[code]) return BY_CODE[code]
  if (status >= 400 && status < 500) {
    const specific = specificMessage(descriptions)
    if (specific) return specific
  }
  if (status === 401 || status === 403) return "O pagamento ainda não está configurado neste ambiente. Tente mais tarde."
  if (status === 404) return "Não encontrei essa cobrança. Atualize a página e tente de novo."
  if (status === 429) return "Muitas tentativas seguidas. Espere um minuto e tente de novo."
  if (status >= 500) return "O serviço de pagamento está instável agora. Tente de novo em instantes."
  return GENERIC
}

export const NETWORK_MESSAGE = "Não consegui falar com o serviço de pagamento agora. Tente de novo em instantes."

export type AsaasConfig = { apiKey: string; baseUrl: string; timeoutMs?: number; fetchImpl?: typeof fetch }

/** The address from the environment: sandbox unless ASAAS_ENV=production, or ASAAS_BASE_URL. */
export function baseUrlFromEnv(env: Record<string, string | undefined> = process.env): string {
  const custom = env.ASAAS_BASE_URL?.trim()
  if (custom) return custom.replace(/\/+$/, "")
  return env.ASAAS_ENV?.trim() === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3"
}

/** The client, or null when ASAAS_API_KEY is not set (billing is then "not configured", never a crash). */
export function asaasFromEnv(env: Record<string, string | undefined> = process.env): AsaasClient | null {
  const apiKey = env.ASAAS_API_KEY?.trim()
  return apiKey ? createAsaasClient({ apiKey, baseUrl: baseUrlFromEnv(env) }) : null
}

export function createAsaasClient({ apiKey, baseUrl, timeoutMs = 12_000, fetchImpl = fetch }: AsaasConfig) {
  async function call<T>(op: string, method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        signal: controller.signal,
        cache: "no-store",
        headers: { access_token: apiKey, "Content-Type": "application/json", "User-Agent": "Organizzou/1.0" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      console.error(JSON.stringify({ event: "asaas_error", op, status: 0, codes: ["network_or_timeout"] }))
      throw new AsaasError(NETWORK_MESSAGE, 0, ["network_or_timeout"])
    } finally {
      clearTimeout(timer)
    }
    const json = (await response.json().catch(() => null)) as (T & { errors?: { code?: string; description?: string }[] }) | null
    if (!response.ok) {
      const errors = json?.errors ?? []
      const codes = errors.map((e) => String(e.code ?? "")).filter(Boolean)
      // For a 4xx the validation messages say WHICH field Asaas did not accept; they are cleaned before they reach the log.
      const descriptions = response.status >= 400 && response.status < 500 ? errors.map((e) => sanitizeDescription(e.description)).filter(Boolean) : []
      console.error(JSON.stringify({ event: "asaas_error", op, status: response.status, codes, ...(descriptions.length > 0 && { descriptions }) }))
      // The message is chosen from Asaas's own text (kept in memory only, never logged); the log gets the cleaned copy.
      const raw = errors.map((e) => String(e.description ?? ""))
      throw new AsaasError(messageFor(response.status, codes, raw), response.status, codes)
    }
    return json as T
  }

  return {
    createCustomer: (input: CustomerBody) => call<{ id: string }>("createCustomer", "POST", "/customers", input),

    createSubscription: (input: SubscriptionBody) =>
      call<AsaasSubscription>("createSubscription", "POST", "/subscriptions", input),

    /** Changes value or cycle (a plan change). `updatePendingPayments: false` keeps the charges already generated as they are. */
    updateSubscription: (id: string, input: { value?: number; cycle?: AsaasCycle; nextDueDate?: string; description?: string; updatePendingPayments?: boolean }) => call<AsaasSubscription>("updateSubscription", "PUT", `/subscriptions/${encodeURIComponent(id)}`, input),

    /** Ends the recurrence and removes the charges not paid yet. Paid ones stay. */
    deleteSubscription: (id: string) => call<{ deleted: boolean; id: string }>("deleteSubscription", "DELETE", `/subscriptions/${encodeURIComponent(id)}`),

    listSubscriptionPayments: (id: string) => call<{ data: AsaasPayment[] }>("listSubscriptionPayments", "GET", `/subscriptions/${encodeURIComponent(id)}/payments`),

    /** Changes one pending charge (the first month's launch price). Asaas asks for billingType, value and dueDate together. */
    updatePayment: (id: string, input: { billingType: AsaasBillingType; value: number; dueDate: string; description?: string }) => call<AsaasPayment>("updatePayment", "PUT", `/payments/${encodeURIComponent(id)}`, input),

    createPayment: (input: { customer: string; billingType: AsaasBillingType; value: number; dueDate: string; description: string; externalReference: string; callback?: { successUrl: string; autoRedirect: boolean } }) => call<AsaasPayment>("createPayment", "POST", "/payments", input),

    getPayment: (id: string) => call<AsaasPayment>("getPayment", "GET", `/payments/${encodeURIComponent(id)}`),

    /** The Pix QR code (image in base64 and the copy-and-paste text). The call needs no body. */
    getPixQrCode: (id: string) => call<AsaasPixQrCode>("getPixQrCode", "GET", `/payments/${encodeURIComponent(id)}/pixQrCode`),
  }
}

export type AsaasClient = ReturnType<typeof createAsaasClient>
