import {
  AppleIcon,
  BookOpenIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  DumbbellIcon,
  FlameIcon,
  GlassWaterIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  HourglassIcon,
  MoonIcon,
  NotebookPenIcon,
  ReceiptTextIcon,
  RepeatIcon,
  ScaleIcon,
  SmileIcon,
  SquareCheckIcon,
  TimerIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

import type { ModuleId } from "@/components/organizzou/modules"

/**
 * What can be on "Hoje". Client-safe metadata only (ids, titles, icons, modules, defaults): the data and the components live in
 * `src/components/organizzou/today/registry.tsx`. A widget is a "stat" (one of the 4 highlight cards) or a "panel".
 */
export type WidgetKind = "stat" | "panel"

export type WidgetMeta = {
  id: string
  title: string
  icon: LucideIcon
  module: ModuleId
  kind: WidgetKind
  defaultVisible: boolean
}

// Generic on the id so the literal ids survive (StatId / PanelId are unions of them).
const stat = <I extends string>(id: I, title: string, icon: LucideIcon, module: ModuleId, defaultVisible = false) => ({ id, title, icon, module, kind: "stat" as const, defaultVisible })
const panel = <I extends string>(id: I, title: string, icon: LucideIcon, module: ModuleId) => ({ id, title, icon, module, kind: "panel" as const, defaultVisible: true })

/** The stat catalog, in the order the customizer lists it (grouped by module there). `defaultVisible` = in the default 4. */
export const STAT_WIDGETS = [
  stat("tarefas-hoje", "Tarefas de hoje", SquareCheckIcon, "tarefas", true),
  stat("habitos-hoje", "Hábitos de hoje", RepeatIcon, "rotina", true),
  stat("gasto-hoje", "Gasto de hoje", WalletIcon, "financas", true),
  stat("sobra-mes", "Sobra do mês", WalletIcon, "financas"),
  stat("proxima-conta", "Próxima conta a vencer", ReceiptTextIcon, "financas"),
  stat("agua", "Água", GlassWaterIcon, "dieta", true),
  stat("calorias", "Calorias", AppleIcon, "dieta"),
  stat("peso", "Peso atual", ScaleIcon, "dieta"),
  stat("treino-semana", "Treino da semana", DumbbellIcon, "treinos"),
  stat("estudo-semana", "Horas de estudo (semana)", GraduationCapIcon, "estudos"),
  stat("proxima-prova", "Próxima prova", HourglassIcon, "estudos"),
  stat("proximo-evento", "Próximo evento", CalendarClockIcon, "agenda"),
  stat("proximo-lembrete", "Próximo lembrete", TimerIcon, "notas"),
  stat("sequencia", "Sequência (streak)", FlameIcon, "rotina"),
  stat("sono", "Sono de ontem", MoonIcon, "diario"),
  stat("humor-semana", "Humor da semana", SmileIcon, "diario"),
] satisfies readonly WidgetMeta[]

export const PANEL_WIDGETS = [
  panel("seu-dia", "Seu dia", CalendarDaysIcon, "agenda"),
  panel("notas", "Notas e lembretes", NotebookPenIcon, "notas"),
  panel("financas", "Finanças", WalletIcon, "financas"),
  panel("dieta", "Dieta e água", AppleIcon, "dieta"),
  panel("treino", "Treino", DumbbellIcon, "treinos"),
  panel("estudos", "Estudos", BookOpenIcon, "estudos"),
  panel("humor", "Como você está?", HeartPulseIcon, "diario"),
] satisfies readonly WidgetMeta[]

export type StatId = (typeof STAT_WIDGETS)[number]["id"]
export type PanelId = (typeof PANEL_WIDGETS)[number]["id"]

export const STAT_IDS = STAT_WIDGETS.map((w) => w.id) as StatId[]
export const PANEL_IDS = PANEL_WIDGETS.map((w) => w.id) as PanelId[]

export const statMeta = (id: string): WidgetMeta | undefined => STAT_WIDGETS.find((w) => w.id === id)
export const panelMeta = (id: string): WidgetMeta | undefined => PANEL_WIDGETS.find((w) => w.id === id)
export const isStatId = (id: unknown): id is StatId => typeof id === "string" && STAT_IDS.includes(id as StatId)
export const isPanelId = (id: unknown): id is PanelId => typeof id === "string" && PANEL_IDS.includes(id as PanelId)
