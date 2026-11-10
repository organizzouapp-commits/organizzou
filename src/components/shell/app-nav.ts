import { FolderIcon, HeartPulseIcon } from "lucide-react"

import { modules, type ModuleId } from "@/components/organizzou/modules"

import { ACCOUNT_GROUP_LABEL, ACCOUNT_ITEMS } from "./account-menu"
import { moreSections, type NavConfig, type NavGroup, type NavItem } from "./nav-config"


/** ONE flat list of account entries (Configurações, Ajuda): the sidebar, the rail, the phone "Outros" sheet and the palette read it. */
const accountItems: NavItem[] = ACCOUNT_ITEMS

function item(id: ModuleId): NavItem {
  const m = modules[id]
  return { id: m.id, label: m.name, href: m.href, icon: m.icon }
}

/** Sidebar, rail and mobile-header grouping (DESIGN-SYSTEM §5.2). The first group is always visible, the others fold in the sidebar. */
const groups: NavGroup[] = [
  { id: "menu", label: "Menu", items: (["hoje", "tarefas", "agenda", "financas"] as ModuleId[]).map(item) },
  { id: "vida", label: "Vida", icon: HeartPulseIcon, items: (["rotina", "treinos", "dieta", "estudos"] as ModuleId[]).map(item) },
  { id: "organizacao", label: "Organização", icon: FolderIcon, items: (["notas", "metas", "diario", "cofre"] as ModuleId[]).map(item) },
]

const pill = (["hoje", "tarefas", "agenda"] as ModuleId[]).map(item)

export const appNav: NavConfig = {
  id: "app",
  home: { href: "/dashboard", label: "Organizzou — Hoje" },
  groups,
  account: { label: ACCOUNT_GROUP_LABEL, items: accountItems },
  mobile: {
    pill,
    more: {
      label: "Outros",
      title: "Outros módulos",
      // Finanças has no heading of its own (it is the only leftover of the main group), Vida and Organização keep theirs.
      sections: [
        ...moreSections(
          groups,
          pill.map((p) => p.href),
          { headlessMain: true }
        ),
        { label: ACCOUNT_GROUP_LABEL, items: accountItems },
      ],
    },
  },
  pageMeta: {
    "/dashboard/tarefas": { title: "Tarefas", subtitle: "Quadros, listas e prazos." },
    "/dashboard/rotina": { title: "Rotina", subtitle: "Pequenos hábitos, todos os dias." },
    "/dashboard/agenda": { title: "Agenda", subtitle: "Eventos, tarefas com data, treinos e estudos." },
    "/dashboard/financas": { title: "Finanças", subtitle: "Para onde o dinheiro vai, sem planilha." },
    "/dashboard/treinos": { title: "Treinos", subtitle: "Séries, carga e descanso." },
    "/dashboard/dieta": { title: "Dieta", subtitle: "Calorias, macros e água do dia." },
    "/dashboard/estudos": { title: "Estudos", subtitle: "Foco, constância e revisão no tempo certo." },
    "/dashboard/notas": { title: "Notas e lembretes", subtitle: "Anote agora, encontre depois." },
    "/dashboard/cofre": { title: "Cofre", subtitle: "Criptografado no seu aparelho. Só você abre." },
    "/dashboard/metas": { title: "Metas", subtitle: "Objetivos alimentados pelos seus módulos." },
    "/dashboard/diario": { title: "Diário", subtitle: "Um minuto por dia para entender seu humor." },
    "/dashboard/configuracoes": { title: "Configurações", subtitle: "Conta, aparência, avisos e plano em um só lugar." },
    "/dashboard/ajuda": { title: "Ajuda", subtitle: "Dúvidas frequentes e contato." },
  },
  features: { assistant: true, notifications: true, plan: true, greeting: true },
}

