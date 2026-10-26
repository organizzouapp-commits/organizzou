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
  // Not in DESIGN-SYSTEM §7 yet: target / book-open keep the same Lucide stroke style.
  metas: { id: "metas", name: "Metas", icon: TargetIcon, href: "/metas" },
  diario: { id: "diario", name: "Diário", icon: BookOpenIcon, href: "/diario" },
}

export const moduleList = Object.values(modules)
