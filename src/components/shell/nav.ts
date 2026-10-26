import type { ModuleId } from "@/components/organizzou/modules"

export type NavGroup = { label: string; items: ModuleId[] }

/** Sidebar and "Mais" sheet grouping (DESIGN-SYSTEM §5.2). */
export const NAV_GROUPS: NavGroup[] = [
  { label: "Menu", items: ["hoje", "tarefas", "rotina", "agenda"] },
  { label: "Vida", items: ["financas", "treinos", "dieta", "estudos"] },
  { label: "Organização", items: ["notas", "metas", "diario", "cofre"] },
]

export type PageMeta = { title: string; subtitle: string }

/** Title and subtitle shown in the top bar. "/hoje" uses a greeting instead (see AppTopBar). */
export const PAGE_META: Record<string, PageMeta> = {
  "/tarefas": { title: "Tarefas", subtitle: "Quadros, listas e prazos." },
  "/rotina": { title: "Rotina", subtitle: "Pequenos hábitos, todos os dias." },
  "/agenda": { title: "Agenda", subtitle: "Eventos, tarefas com data, treinos e estudos." },
  "/financas": { title: "Finanças", subtitle: "Para onde o dinheiro vai, sem planilha." },
  "/treinos": { title: "Treinos", subtitle: "Séries, carga e descanso." },
  "/dieta": { title: "Dieta", subtitle: "Calorias, macros e água do dia." },
  "/estudos": { title: "Estudos", subtitle: "Foco, constância e revisão no tempo certo." },
  "/notas": { title: "Notas e lembretes", subtitle: "Anote agora, encontre depois." },
  "/cofre": { title: "Cofre", subtitle: "Criptografado no seu aparelho." },
  "/metas": { title: "Metas", subtitle: "Objetivos alimentados pelos seus módulos." },
  "/diario": { title: "Diário", subtitle: "Um minuto por dia para entender seu humor." },
  "/configuracoes": { title: "Configurações", subtitle: "Conta, avisos e segurança." },
}

export function metaFor(pathname: string): PageMeta | null {
  const key = Object.keys(PAGE_META).find((k) => pathname === k || pathname.startsWith(`${k}/`))
  return key ? PAGE_META[key] : null
}
