import type { Metadata } from "next"
import { SparklesIcon } from "lucide-react"

import { EmptyState } from "@/components/organizzou/EmptyState"

export const metadata: Metadata = { title: "Hoje — Organizzou" }

export default function TodayPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em] md:text-[28px] md:leading-[34px]">
        Hoje
      </h1>
      <EmptyState
        icon={SparklesIcon}
        title="Tudo certo por hoje."
        description="Quando você criar tarefas, hábitos e compromissos, o resumo do dia aparece aqui."
      />
    </div>
  )
}
