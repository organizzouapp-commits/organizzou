import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { HourglassIcon } from "lucide-react"

import { EmptyState } from "@/components/organizzou/EmptyState"
import { moduleList } from "@/components/organizzou/modules"

// Placeholder for modules that arrive in later phases. Known slugs only.
const placeholders = moduleList.filter((m) => m.id !== "hoje" && m.id !== "tarefas")
const bySlug = new Map(placeholders.map((m) => [m.href.slice(1), m]))

export function generateStaticParams() {
  return [...bySlug.keys(), "metas", "diario"].map((modulo) => ({ modulo }))
}

type Props = { params: Promise<{ modulo: string }> }

const extra: Record<string, string> = { metas: "Metas", diario: "Diário" }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { modulo } = await params
  const name = bySlug.get(modulo)?.name ?? extra[modulo]
  return { title: name ? `${name} — Organizzou` : "Organizzou" }
}

export default async function ModulePlaceholderPage({ params }: Props) {
  const { modulo } = await params
  const found = bySlug.get(modulo)
  const name = found?.name ?? extra[modulo]
  if (!name) notFound()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em] md:text-[28px] md:leading-[34px]">
        {name}
      </h1>
      <EmptyState
        icon={found?.icon ?? HourglassIcon}
        title="Em breve"
        description="Este módulo chega nas próximas etapas."
      />
    </div>
  )
}
