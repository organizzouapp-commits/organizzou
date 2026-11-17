// What a failed push delivery means. The push services (FCM, Mozilla, Apple, Windows) answer with an HTTP status; web-push throws it as
// statusCode. Only the status and the host are ever logged, never the endpoint, keys or payload.

export type PushFailureCode = "gone" | "vapid_rejected" | "bad_request" | "payload_too_large" | "rate_limited" | "server_error" | "network" | "unknown"

export type PushFailure = { code: PushFailureCode; status: number | null; /** The subscription is dead: delete it. */ remove: boolean }

export function classifyPushError(error: unknown): PushFailure {
  const e = (error ?? {}) as { statusCode?: unknown; code?: unknown; message?: unknown }
  const status = typeof e.statusCode === "number" ? e.statusCode : null
  if (status === 404 || status === 410) return { code: "gone", status, remove: true }
  if (status === 401 || status === 403) return { code: "vapid_rejected", status, remove: false }
  if (status === 400) return { code: "bad_request", status, remove: false }
  if (status === 413) return { code: "payload_too_large", status, remove: false }
  if (status === 429) return { code: "rate_limited", status, remove: false }
  if (status !== null && status >= 500) return { code: "server_error", status, remove: false }
  const text = `${typeof e.code === "string" ? e.code : ""} ${typeof e.message === "string" ? e.message : ""}`
  if (/ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|network/i.test(text)) return { code: "network", status, remove: false }
  return { code: "unknown", status, remove: false }
}

export const PUSH_FAILURE_MESSAGES: Record<PushFailureCode, string> = {
  gone: "O navegador apagou este aparelho (a inscrição expirou). Desative e ative de novo.",
  vapid_rejected: "O serviço de push do navegador recusou as chaves do servidor (erro 401/403). Isso acontece quando as chaves foram trocadas depois de ativar: desative e ative de novo neste aparelho.",
  bad_request: "O serviço de push do navegador recusou o pedido (erro 400). Desative e ative de novo neste aparelho.",
  payload_too_large: "A notificação ficou grande demais para o serviço de push (erro 413).",
  rate_limited: "O serviço de push pediu para esperar um pouco (erro 429). Tente de novo em alguns minutos.",
  server_error: "O serviço de push do navegador está instável agora (erro 5xx). Tente de novo em instantes.",
  network: "O servidor não conseguiu falar com o serviço de push do navegador. Tente de novo em instantes.",
  unknown: "O envio falhou por um motivo desconhecido. Desative e ative de novo neste aparelho.",
}

/** The host of a push endpoint ("fcm.googleapis.com"): the only part of it that is safe to log. */
export function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).hostname
  } catch {
    return "invalid"
  }
}

/** Failures grouped by code, e.g. { vapid_rejected: 2 }. */
export type FailureCounts = Partial<Record<PushFailureCode, number>>
