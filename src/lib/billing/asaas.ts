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
  invalid_email: "O e-mail da conta não foi aceito pelo serviço de pagamento.",
  invalid_value: "O valor da cobrança não foi aceito. Tente de novo em instantes.",
  invalid_dueDate: "A data da cobrança não foi aceita. Tente de novo em instantes.",
}

/** The friendly message for a failed response. Pure. */
export function messageFor(status: number, codes: string[]): string {
  for (const code of codes) if (BY_CODE[code]) return BY_CODE[code]
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
    const json = (await response.json().catch(() => null)) as (T & { errors?: { code?: string }[] }) | null
    if (!response.ok) {
      const codes = (json?.errors ?? []).map((e) => String(e.code ?? "")).filter(Boolean)
      console.error(JSON.stringify({ event: "asaas_error", op, status: response.status, codes }))
      throw new AsaasError(messageFor(response.status, codes), response.status, codes)
    }
    return json as T
  }

  return {
    createCustomer: (input: { name: string; cpfCnpj: string; email: string; externalReference: string }) => call<{ id: string }>("createCustomer", "POST", "/customers", { ...input, notificationDisabled: false }),

    createSubscription: (input: { customer: string; billingType: AsaasBillingType; value: number; nextDueDate: string; cycle: AsaasCycle; description: string; externalReference: string; callback?: { successUrl: string; autoRedirect: boolean } }) =>
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
