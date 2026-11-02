import {
  ActivityIcon,
  BriefcaseBusinessIcon,
  ChartColumnIcon,
  CreditCardIcon,
  HeartPulseIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  ListChecksIcon,
  PackageIcon,
  PlugIcon,
  ScrollTextIcon,
  ServerIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react"

import { moreSections, type NavConfig, type NavGroup, type NavItem } from "./nav-config"

const overview: NavItem = { id: "visao-geral", label: "Visão geral", href: "/admin", icon: LayoutDashboardIcon }
const users: NavItem = { id: "usuarios", label: "Usuários", href: "/admin/usuarios", icon: UsersIcon }
const activity: NavItem = { id: "atividade", label: "Atividade", href: "/admin/atividade", icon: ActivityIcon }
const billing: NavItem = { id: "assinaturas", label: "Assinaturas e pagamentos", href: "/admin/assinaturas", icon: CreditCardIcon }
const waitlist: NavItem = { id: "lista-de-espera", label: "Lista de espera", href: "/admin/lista-de-espera", icon: ListChecksIcon }
const plans: NavItem = { id: "planos", label: "Planos e limites", href: "/admin/planos", icon: SlidersHorizontalIcon }
const modulesUsage: NavItem = { id: "modulos", label: "Uso dos módulos", href: "/admin/modulos", icon: ChartColumnIcon }
const assistant: NavItem = { id: "assistente", label: "Assistente e IA", href: "/admin/assistente", icon: SparklesIcon }
const integrations: NavItem = { id: "integracoes", label: "Integrações", href: "/admin/integracoes", icon: PlugIcon }
const status: NavItem = { id: "status", label: "Status", href: "/admin/status", icon: HeartPulseIcon }
const support: NavItem = { id: "suporte", label: "Suporte", href: "/admin/suporte", icon: LifeBuoyIcon }
const audit: NavItem = { id: "auditoria", label: "Auditoria", href: "/admin/auditoria", icon: ScrollTextIcon }

const groups: NavGroup[] = [
  { id: "geral", label: "Geral", items: [overview, users, activity] },
  { id: "negocio", label: "Negócio", icon: BriefcaseBusinessIcon, items: [billing, waitlist, plans] },
  { id: "produto", label: "Produto", icon: PackageIcon, items: [modulesUsage, assistant, integrations] },
  { id: "sistema", label: "Sistema", icon: ServerIcon, items: [status, support, audit] },
]

// Short label on the pill: "Assinaturas e pagamentos" does not fit next to an icon.
const pill: NavItem[] = [overview, users, { ...billing, label: "Pagamentos" }, status]

export const adminNav: NavConfig = {
  id: "admin",
  home: { href: "/admin", label: "Organizzou Admin — Visão geral" },
  badge: "Admin",
  groups,
  account: null,
  mobile: {
    pill,
    more: {
      label: "Mais",
      title: "Mais páginas",
      sections: moreSections(
        groups,
        pill.map((p) => p.href),
        { headlessMain: false }
      ),
    },
  },
  pageMeta: {
    "/admin/usuarios": { title: "Usuários", subtitle: "Contas, planos e acesso. Só dados da conta, nunca o conteúdo." },
    "/admin/atividade": { title: "Atividade", subtitle: "Quem volta, quando e com que frequência." },
    "/admin/assinaturas": { title: "Assinaturas e pagamentos", subtitle: "Planos em uso e o que ainda falta ligar." },
    "/admin/lista-de-espera": { title: "Lista de espera", subtitle: "Quem pediu para entrar e de onde veio." },
    "/admin/planos": { title: "Planos e limites", subtitle: "O que cada plano inclui, como está no código." },
    "/admin/modulos": { title: "Uso dos módulos", subtitle: "Contagens agregadas, sem abrir nenhum conteúdo." },
    "/admin/assistente": { title: "Assistente e IA", subtitle: "Volume, ações executadas e confirmações." },
    "/admin/integracoes": { title: "Integrações", subtitle: "O que é real, simulado ou ainda não construído." },
    "/admin/status": { title: "Status", subtitle: "Verificações ao vivo feitas pelo servidor." },
    "/admin/suporte": { title: "Suporte", subtitle: "Problemas reportados pelas pessoas." },
    "/admin/auditoria": { title: "Auditoria", subtitle: "Tudo que um admin fez na conta de alguém." },
    "/admin": { title: "Visão geral", subtitle: "Como o Organizzou está hoje." },
  },
  features: { assistant: false, notifications: false, plan: false, greeting: false },
}
