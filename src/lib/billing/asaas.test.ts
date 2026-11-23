import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { AsaasError, asaasFromEnv, baseUrlFromEnv, createAsaasClient, messageFor, NETWORK_MESSAGE } from "./asaas"

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

afterEach(() => vi.restoreAllMocks())

describe("which Asaas", () => {
  it("sandbox unless ASAAS_ENV=production, with an optional ASAAS_BASE_URL override", () => {
    expect(baseUrlFromEnv({})).toBe("https://api-sandbox.asaas.com/v3")
    expect(baseUrlFromEnv({ ASAAS_ENV: "sandbox" })).toBe("https://api-sandbox.asaas.com/v3")
    expect(baseUrlFromEnv({ ASAAS_ENV: "production" })).toBe("https://api.asaas.com/v3")
    expect(baseUrlFromEnv({ ASAAS_ENV: "production", ASAAS_BASE_URL: "https://example.test/v3/" })).toBe("https://example.test/v3")
  })
  it("no key, no client (billing is simply not configured)", () => {
    expect(asaasFromEnv({})).toBeNull()
    expect(asaasFromEnv({ ASAAS_API_KEY: "  " })).toBeNull()
    expect(asaasFromEnv({ ASAAS_API_KEY: "k" })).not.toBeNull()
  })
})

describe("the client", () => {
  it("sends the key in the access_token header, JSON, a user agent, to the right address", async () => {
    const fetchImpl = vi.fn(async () => reply(200, { id: "cus_1" }))
    const client = createAsaasClient({ apiKey: "KEY-123", baseUrl: "https://x.test/v3", fetchImpl: fetchImpl as never })
    expect(await client.createCustomer({ name: "Ana", cpfCnpj: "52998224725", email: "a@b.c", externalReference: "u1" })).toEqual({ id: "cus_1" })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://x.test/v3/customers")
    expect(init.method).toBe("POST")
    expect(init.headers).toMatchObject({ access_token: "KEY-123", "Content-Type": "application/json", "User-Agent": "Organizzou/1.0" })
  })
  it("a failure becomes a friendly pt-BR error and the log has only the operation, the status and the codes (no key, no personal data)", async () => {
    const log = vi.fn()
    console.error = log
    const fetchImpl = vi.fn(async () => reply(400, { errors: [{ code: "invalid_cpfCnpj", description: "O CPF 52998224725 é inválido" }] }))
    const client = createAsaasClient({ apiKey: "KEY-123", baseUrl: "https://x.test/v3", fetchImpl: fetchImpl as never })
    const error = await client.createCustomer({ name: "Ana", cpfCnpj: "52998224725", email: "ana@exemplo.com", externalReference: "u1" }).catch((e) => e)
    expect(error).toBeInstanceOf(AsaasError)
    expect(error.userMessage).toBe("CPF ou CNPJ inválido. Confira os números e tente de novo.")
    const logged = String(log.mock.calls[0][0])
    expect(logged).toContain("invalid_cpfCnpj")
    for (const secret of ["KEY-123", "52998224725", "ana@exemplo.com", "Ana"]) expect(logged).not.toContain(secret)
  })
  it("a network failure or a timeout gets its own message", async () => {
    console.error = vi.fn()
    const down = createAsaasClient({ apiKey: "k", baseUrl: "https://x.test/v3", fetchImpl: (async () => Promise.reject(new TypeError("fetch failed"))) as never })
    expect(await down.getPayment("pay_1").catch((e) => e.userMessage)).toBe(NETWORK_MESSAGE)
    const slow = createAsaasClient({ apiKey: "k", baseUrl: "https://x.test/v3", timeoutMs: 5, fetchImpl: ((_url: string, init: RequestInit) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as never })
    expect(await slow.getPayment("pay_1").catch((e) => e.userMessage)).toBe(NETWORK_MESSAGE)
  })
  it("maps the statuses", () => {
    expect(messageFor(401, [])).toMatch(/não está configurado/)
    expect(messageFor(429, [])).toMatch(/Muitas tentativas/)
    expect(messageFor(503, [])).toMatch(/instável/)
    expect(messageFor(400, ["something_else"])).toMatch(/recusou o pedido/)
  })
  it("path parts are encoded", async () => {
    const fetchImpl = vi.fn(async () => reply(200, { deleted: true, id: "x" }))
    const client = createAsaasClient({ apiKey: "k", baseUrl: "https://x.test/v3", fetchImpl: fetchImpl as never })
    await client.deleteSubscription("sub/../1")
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://x.test/v3/subscriptions/sub%2F..%2F1")
  })
})
