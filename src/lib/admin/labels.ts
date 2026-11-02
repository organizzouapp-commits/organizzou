/** pt-BR names for admin audit actions, plans and statuses. Client-safe. */
export const ACTION_LABELS: Record<string, string> = {
  "plan.change": "Plano alterado",
  "user.suspend": "Conta suspensa",
  "user.reactivate": "Conta reativada",
  "user.resend_confirmation": "Confirmação reenviada",
  "user.sign_out_all": "Sessões encerradas",
  "users.export": "Usuários exportados",
  "waitlist.export": "Lista de espera exportada",
  "admin.grant": "Admin concedido",
  "admin.revoke": "Admin removido",
}

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action

export const PLAN_LABELS = { free: "Gratuito", pro: "Pro" } as const

export const STATUS_LABELS = { active: "Ativo", suspended: "Suspenso", pending: "Aguardando confirmação" } as const

export const SOURCE_LABELS: Record<string, string> = { "em-breve": "Site", "plano-pro": "Plano Pro (diálogo)" }

export const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source

export const PROVIDER_LABELS: Record<string, string> = { email: "E-mail", google: "Google" }

export const providerLabel = (provider: string) =>
  provider
    .split(/,\s*/)
    .map((p) => PROVIDER_LABELS[p] ?? p)
    .join(", ")
