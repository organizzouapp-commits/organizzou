import { BadgeDollarSignIcon, BellRingIcon, BrainCircuitIcon, KeyRoundIcon, LandmarkIcon, MessageCircleIcon, ShieldCheckIcon, type LucideIcon } from "lucide-react"

/** Mirrors docs/INTEGRATIONS-STATUS.md (the single source of truth for what is real). Update both together. */
export type IntegrationStatus = "real" | "simulated" | "not-built"

export const STATUS_TEXT: Record<IntegrationStatus, string> = { real: "Real", simulated: "Simulado", "not-built": "Não construído" }

export type Integration = {
  id: string
  name: string
  icon: LucideIcon
  status: IntegrationStatus
  /** One line: what it is and where it stands. */
  summary: string
  /** Where it lives in the code, for whoever picks it up. */
  where: string
}

export const INTEGRATIONS: Integration[] = [
  { id: "auth", name: "Supabase Auth", icon: ShieldCheckIcon, status: "real", summary: "Cadastro e login com e-mail e senha, recuperação de senha.", where: "src/features/auth/actions.ts" },
  { id: "google", name: "Login com Google", icon: KeyRoundIcon, status: "real", summary: "OAuth pelo Supabase. Exige o provedor configurado no painel.", where: "src/app/auth/callback/route.ts" },
  { id: "claude", name: "Claude API", icon: BrainCircuitIcon, status: "real", summary: "Assistente do app (chat com ferramentas) e captura rápida: regras primeiro, o modelo só quando precisa. Liga quando ANTHROPIC_API_KEY está definida; sem ela tudo segue funcionando por regras.", where: "src/server/assistant/engine.ts" },
  { id: "whatsapp", name: "WhatsApp", icon: MessageCircleIcon, status: "not-built", summary: "Conectar número, texto e voz com o assistente: nada disso existe ainda.", where: "src/components/settings/settings-extras.tsx" },
  { id: "openfinance", name: "Open Finance", icon: LandmarkIcon, status: "not-built", summary: "Conectar banco e importar lançamentos: só o aviso “Em breve”.", where: "src/components/finance/financas-screen.tsx" },
  { id: "push", name: "Notificações push", icon: BellRingIcon, status: "not-built", summary: "O sino mostra exemplos fixos; nada é enviado.", where: "src/components/shell/app-topbar.tsx" },
  { id: "payments", name: "Pagamentos", icon: BadgeDollarSignIcon, status: "not-built", summary: "Sem provedor, sem cobrança e sem dados de cartão.", where: "src/lib/admin/billing.ts" },
]
