import {
  AppleIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  DumbbellIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  NotebookPenIcon,
  RepeatIcon,
  ShieldCheckIcon,
  SquareKanbanIcon,
  TargetIcon,
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
  | "metas"
  | "diario"

export type ModuleDefinition = {
  id: ModuleId
  name: string
  icon: LucideIcon
  href: string
}

// Modules have no color of their own: the icon is what identifies them (DESIGN-SYSTEM §7).
export const modules: Record<ModuleId, ModuleDefinition> = {
  hoje: { id: "hoje", name: "Hoje", icon: LayoutDashboardIcon, href: "/dashboard" },
  tarefas: { id: "tarefas", name: "Tarefas", icon: SquareKanbanIcon, href: "/dashboard/tarefas" },
  rotina: { id: "rotina", name: "Rotina", icon: RepeatIcon, href: "/dashboard/rotina" },
  agenda: { id: "agenda", name: "Agenda", icon: CalendarDaysIcon, href: "/dashboard/agenda" },
  financas: { id: "financas", name: "Finanças", icon: WalletIcon, href: "/dashboard/financas" },
  treinos: { id: "treinos", name: "Treinos", icon: DumbbellIcon, href: "/dashboard/treinos" },
  dieta: { id: "dieta", name: "Dieta", icon: AppleIcon, href: "/dashboard/dieta" },
  estudos: { id: "estudos", name: "Estudos", icon: GraduationCapIcon, href: "/dashboard/estudos" },
  notas: { id: "notas", name: "Notas e lembretes", icon: NotebookPenIcon, href: "/dashboard/notas" },
  cofre: { id: "cofre", name: "Cofre", icon: ShieldCheckIcon, href: "/dashboard/cofre" },
  // Not in DESIGN-SYSTEM §7 yet: target / book-open keep the same Lucide stroke style.
  metas: { id: "metas", name: "Metas", icon: TargetIcon, href: "/dashboard/metas" },
  diario: { id: "diario", name: "Diário", icon: BookOpenIcon, href: "/dashboard/diario" },
}

export const moduleList = Object.values(modules)
