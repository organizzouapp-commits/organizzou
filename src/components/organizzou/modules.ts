import {
  AppleIcon,
  CalendarDaysIcon,
  DumbbellIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  NotebookPenIcon,
  RepeatIcon,
  ShieldCheckIcon,
  SquareKanbanIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

export type ModuleId =
  | "hoje"
  | "tarefas"
  | "rotina"
  | "agenda"
  | "financas"
  | "treinos"
  | "dieta"
  | "estudos"
  | "notas"
  | "cofre"

export type ModuleDefinition = {
  id: ModuleId
  name: string
  icon: LucideIcon
  href: string
}

// Modules have no color of their own: the icon is what identifies them (DESIGN-SYSTEM §7).
export const modules: Record<ModuleId, ModuleDefinition> = {
  hoje: { id: "hoje", name: "Hoje", icon: LayoutDashboardIcon, href: "/hoje" },
  tarefas: { id: "tarefas", name: "Tarefas", icon: SquareKanbanIcon, href: "/tarefas" },
  rotina: { id: "rotina", name: "Rotina", icon: RepeatIcon, href: "/rotina" },
  agenda: { id: "agenda", name: "Agenda", icon: CalendarDaysIcon, href: "/agenda" },
  financas: { id: "financas", name: "Finanças", icon: WalletIcon, href: "/financas" },
  treinos: { id: "treinos", name: "Treinos", icon: DumbbellIcon, href: "/treinos" },
  dieta: { id: "dieta", name: "Dieta", icon: AppleIcon, href: "/dieta" },
  estudos: { id: "estudos", name: "Estudos", icon: GraduationCapIcon, href: "/estudos" },
  notas: { id: "notas", name: "Notas e lembretes", icon: NotebookPenIcon, href: "/notas" },
  cofre: { id: "cofre", name: "Cofre", icon: ShieldCheckIcon, href: "/cofre" },
}

export const moduleList = Object.values(modules)
