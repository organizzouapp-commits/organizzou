import { Suspense, type ReactNode } from "react"

import { PANEL_WIDGETS, STAT_WIDGETS, type PanelId, type StatId, type WidgetMeta } from "@/features/today/catalog"
import type { PanelDataMap } from "@/features/today/types"
import { getDay, getDiet, getFinance, getMood, getNotes, getStat, getStudy, getWorkout } from "@/features/today/data"

import { DietPanel, FinancePanel, MoodPanel, NotesPanel, StudyPanel, WorkoutPanel } from "./panels"
import { SeuDia } from "./seu-dia"
import { StatCard, StatCardSkeleton } from "./stat-card"
import { PanelSkeleton, WidgetError } from "./widget-error"

/**
 * The widget registry (server). Each widget = { id, title, icon, module, kind, defaultVisible } (from the catalog) plus:
 *  - `component`: an async server component that fetches ITS OWN data and renders it, with its own error state;
 *  - `skeleton`: what shows (after 200 ms) while that data streams in, shaped like the real widget.
 * `renderWidget` wraps the pair in a Suspense boundary, so no widget waits for another and none blocks the page shell.
 */
export type WidgetDef = WidgetMeta & {
  component: (props: { nowIso: string }) => ReactNode | Promise<ReactNode>
  skeleton: ReactNode
}

async function StatWidget({ id, nowIso }: { id: StatId; nowIso: string }) {
  const meta = STAT_WIDGETS.find((w) => w.id === id)!
  let data
  try {
    data = await getStat(id, nowIso)
  } catch {
    return <WidgetError title={meta.title} compact />
  }
  return <StatCard data={data} />
}

/** Loads the data of one panel. Kept apart from the JSX so a failure is caught here and shown as that panel's own error card. */
async function loadPanel(id: PanelId, nowIso: string): Promise<PanelDataMap[PanelId]> {
  switch (id) {
    case "seu-dia":
      return getDay(nowIso)
    case "notas":
      return getNotes(nowIso)
    case "financas":
      return getFinance(nowIso)
    case "dieta":
      return getDiet(nowIso)
    case "treino":
      return getWorkout(nowIso)
    case "estudos":
      return getStudy(nowIso)
    case "humor":
      return getMood(nowIso)
  }
}

async function PanelBody({ id, nowIso }: { id: PanelId; nowIso: string }) {
  const meta = PANEL_WIDGETS.find((w) => w.id === id)!
  let data: PanelDataMap[PanelId]
  try {
    data = await loadPanel(id, nowIso)
  } catch {
    return <WidgetError title={meta.title} />
  }
  switch (id) {
    case "seu-dia":
      return <SeuDia data={data as PanelDataMap["seu-dia"]} />
    case "notas":
      return <NotesPanel data={data as PanelDataMap["notas"]} />
    case "financas":
      return <FinancePanel data={data as PanelDataMap["financas"]} />
    case "dieta":
      return <DietPanel data={data as PanelDataMap["dieta"]} />
    case "treino":
      return <WorkoutPanel data={data as PanelDataMap["treino"]} />
    case "estudos":
      return <StudyPanel data={data as PanelDataMap["estudos"]} />
    case "humor":
      return <MoodPanel data={data as PanelDataMap["humor"]} />
  }
}

const PANEL_SKELETON: Record<PanelId, ReactNode> = {
  "seu-dia": <PanelSkeleton rows={5} tall />,
  notas: <PanelSkeleton rows={3} />,
  financas: <PanelSkeleton rows={2} />,
  dieta: <PanelSkeleton rows={2} />,
  treino: <PanelSkeleton rows={1} />,
  estudos: <PanelSkeleton rows={2} />,
  humor: <PanelSkeleton rows={1} />,
}

export const widgetRegistry: Record<string, WidgetDef> = {
  ...Object.fromEntries(STAT_WIDGETS.map((meta) => [`stat:${meta.id}`, { ...meta, component: ({ nowIso }: { nowIso: string }) => <StatWidget id={meta.id} nowIso={nowIso} />, skeleton: <StatCardSkeleton /> } satisfies WidgetDef])),
  ...Object.fromEntries(PANEL_WIDGETS.map((meta) => [`panel:${meta.id}`, { ...meta, component: ({ nowIso }: { nowIso: string }) => <PanelBody id={meta.id} nowIso={nowIso} />, skeleton: PANEL_SKELETON[meta.id] } satisfies WidgetDef])),
}

export function renderWidget(key: string, nowIso: string): ReactNode {
  const def = widgetRegistry[key]
  if (!def) return null
  const Component = def.component
  return (
    <Suspense key={key} fallback={def.skeleton}>
      <Component nowIso={nowIso} />
    </Suspense>
  )
}

export const widgetSkeleton = (key: string): ReactNode => widgetRegistry[key]?.skeleton ?? null
