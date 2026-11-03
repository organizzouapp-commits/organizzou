"use client"

import { TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/** The Tarefas screen could not load its data. */
export default function TasksError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-[16px] border border-border bg-card p-6">
      <p className="flex items-center gap-3 text-[15px] leading-6">
        <TriangleAlertIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" /> Não consegui carregar suas tarefas. Tente de novo.
      </p>
      <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={reset}>
        Tentar de novo
      </Button>
    </div>
  )
}
