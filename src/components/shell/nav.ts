import type { ModuleId } from "@/components/organizzou/modules"

export type NavGroup = { label: string; items: ModuleId[] }

/** Sidebar, rail and mobile-header grouping (DESIGN-SYSTEM §5.2). The first group is always visible, the others fold in the sidebar. */
export const NAV_GROUPS: NavGroup[] = [
  { label: "Menu", items: ["hoje", "tarefas", "agenda", "financas"] },
  { label: "Vida", items: ["rotina", "treinos", "dieta", "estudos"] },
  { label: "Organização", items: ["notas", "metas", "diario", "cofre"] },
]

export type PageMeta = { title: string; subtitle: string }

/** Title and subtitle shown in the top bar. "/dashboard" uses a greeting instead (see AppTopBar). */
export const PAGE_META: Record<string, PageMeta> = {
  "/dashboard/tarefas": { title: "Tarefas", subtitle: "Quadros, listas e prazos." },
  "/dashboard/rotina": { title: "Rotina", subtitle: "Pequenos hábitos, todos os dias." },
  "/dashboard/agenda": { title: "Agenda", subtitle: "Eventos, tarefas com data, treinos e estudos." },
  "/dashboard/financas": { title: "Finanças", subtitle: "Para onde o dinheiro vai, sem planilha." },
  "/dashboard/treinos": { title: "Treinos", subtitle: "Séries, carga e descanso." },
  "/dashboard/dieta": { title: "Dieta", subtitle: "Calorias, macros e água do dia." },
  "/dashboard/estudos": { title: "Estudos", subtitle: "Foco, constância e revisão no tempo certo." },
  "/dashboard/notas": { title: "Notas e lembretes", subtitle: "Anote agora, encontre depois." },
  "/dashboard/cofre": { title: "Cofre", subtitle: "Criptografado no seu aparelho." },
  "/dashboard/metas": { title: "Metas", subtitle: "Objetivos alimentados pelos seus módulos." },
  "/dashboard/diario": { title: "Diário", subtitle: "Um minuto por dia para entender seu humor." },
  "/dashboard/configuracoes": { title: "Configurações", subtitle: "Aparência, avisos e segurança." },
  "/dashboard/perfil": { title: "Perfil", subtitle: "Seus dados e a sua senha." },
  "/dashboard/plano": { title: "Plano Pro", subtitle: "Compare os planos e veja o que muda." },
  "/dashboard/ajuda": { title: "Ajuda", subtitle: "Dúvidas frequentes e contato." },
}

export function metaFor(pathname: string): PageMeta | null {
  const key = Object.keys(PAGE_META).find((k) => pathname === k || pathname.startsWith(`${k}/`))
  return key ? PAGE_META[key] : null
}
