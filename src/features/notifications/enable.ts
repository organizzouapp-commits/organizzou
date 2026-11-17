// Turning notifications on, step by step: every place it can stop has its own pt-BR sentence (nothing fails silently), plus the small pure
// helpers the flow needs. No browser APIs are touched here, so all of it is tested.

export type EnableStep =
  | "no_service_worker"
  | "key_unavailable"
  | "permission_denied"
  | "permission_dismissed"
  | "worker_failed"
  | "worker_not_ready"
  | "subscribe_failed"
  | "save_failed"

const MESSAGES: Record<EnableStep, string> = {
  no_service_worker: "Este navegador não tem service worker, que é o que recebe as notificações. Use o Chrome, o Edge ou o Safari atualizados.",
  key_unavailable: "As notificações ainda não estão ligadas neste servidor. Avise o suporte.",
  permission_denied: "Você bloqueou as notificações para este site. Toque no cadeado ao lado do endereço, abra as permissões do site, mude Notificações para “Permitir” e tente de novo.",
  permission_dismissed: "O navegador não recebeu a sua permissão. Toque em Ativar de novo e escolha “Permitir”. Se o aviso nem aparecer, libere as notificações nas permissões do site.",
  worker_failed: "Não consegui preparar o serviço que recebe as notificações (service worker). Recarregue a página e tente de novo.",
  worker_not_ready: "O serviço que recebe as notificações demorou demais para ficar pronto. Recarregue a página e tente de novo.",
  subscribe_failed: "O navegador não conseguiu criar a inscrição de notificações. Tente de novo.",
  save_failed: "Não consegui guardar este aparelho no servidor. Tente de novo.",
}

export const enableMessage = (step: EnableStep): string => MESSAGES[step]

/** The error thrown by PushManager.subscribe, by name. */
export function subscribeErrorMessage(name: string | undefined): string {
  switch (name) {
    case "NotAllowedError":
      return "O navegador não deixou criar a inscrição: as notificações estão bloqueadas para este site. Libere nas permissões do site e tente de novo."
    case "InvalidAccessError":
      return "O navegador recusou a chave de notificações do servidor (formato inválido). Avise o suporte."
    case "AbortError":
      return "O serviço de push do navegador (Google, Apple ou Mozilla) não respondeu ou recusou a inscrição. Confira a conexão, desative a economia de dados e tente de novo."
    case "InvalidStateError":
      return "Já existe uma inscrição antiga com outra chave neste aparelho. Desative as notificações e ative de novo."
    case "NotSupportedError":
    case "SecurityError":
      return "Este navegador ou este modo (janela anônima, por exemplo) não permite notificações. Use uma janela normal."
    default:
      return MESSAGES.subscribe_failed
  }
}

/** True when an existing subscription was made with exactly this public key (a subscription made with an older key must be replaced). */
export function sameApplicationServerKey(existing: ArrayBuffer | null | undefined, wanted: Uint8Array): boolean {
  if (!existing) return false
  const bytes = new Uint8Array(existing)
  return bytes.length === wanted.length && bytes.every((b, i) => b === wanted[i])
}

/** Rejects (with the given error name) when `promise` takes longer than `ms`; used so a waiting service worker never leaves the button spinning. */
export function withTimeout<T>(promise: Promise<T>, ms: number, name = "TimeoutError"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error(name), { name })), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export const READY_TIMEOUT_MS = 10_000

/** What the toast says after "Enviar notificação de teste". "Teste enviado" only when the push service accepted it for at least one device. */
export function testToast(result: { ok: true; sent: number } | { ok: false; error: string }): { kind: "success" | "error"; text: string } {
  if (result.ok && result.sent > 0) return { kind: "success", text: "Teste enviado. Ele deve chegar em instantes. Se não aparecer, confira as notificações do sistema e do navegador neste aparelho." }
  return { kind: "error", text: result.ok ? "Nenhum aparelho aceitou o teste." : result.error }
}
