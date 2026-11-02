import { Suspense } from "react"
import type { Metadata } from "next"
import { connection } from "next/server"

import { renderWidget, widgetRegistry, widgetSkeleton } from "@/components/organizzou/today/registry"
import { StatCardSkeleton } from "@/components/organizzou/today/stat-card"
import { TodayLayout } from "@/components/organizzou/today/today-layout"
import { PanelSkeleton } from "@/components/organizzou/today/widget-error"
import { readPrefs } from "@/features/today/prefs.server"

export const metadata: Metadata = { title: "Início" }

/**
 * "Hoje". The page shell (this component and the app frame around it) renders at once; every widget below streams in on its own
 * inside its own Suspense boundary. Only the widgets the person chose are rendered on the server.
 */
async function TodayContent() {
  await connection()
  const nowIso = new Date().toISOString()
  const { prefs, source } = await readPrefs()

  const wanted = [...prefs.highlights.map((id) => `stat:${id}`), ...prefs.panels.filter((p) => p.visible).map((p) => `panel:${p.id}`)]
  const slots = Object.fromEntries(wanted.map((key) => [key, renderWidget(key, nowIso)]))
  const skeletons = Object.fromEntries(Object.keys(widgetRegistry).map((key) => [key, widgetSkeleton(key)]))

  return <TodayLayout slots={slots} skeletons={skeletons} serverPrefs={prefs} source={source} />
}

function TodayFallback() {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-5 pb-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <PanelSkeleton rows={5} tall />
    </div>
  )
}

export default function TodayPage() {
  return (
    <Suspense fallback={<TodayFallback />}>
      <TodayContent />
    </Suspense>
  )
}
