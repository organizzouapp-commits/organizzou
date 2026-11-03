"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { TriangleAlertIcon } from "lucide-react"

import { bentoCardClass } from "@/components/organizzou/Bento"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** A widget whose data failed to load. It stays inside its own card: the rest of the page keeps working. */
export function WidgetError({ title, compact, message }: { title: string; compact?: boolean; message?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div role="alert" className={cn(bentoCardClass(), "flex h-full flex-col justify-center gap-3 rounded-[24px] p-5", compact && "min-h-[148px]")}>
      <p className="flex items-start gap-3 text-[15px] leading-6">
        <TriangleAlertIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
        <span>{message ?? `Não foi possível carregar “${title}”.`}</span>
      </p>
      <Button type="button" variant="outline" className="h-11 self-start rounded-full px-5" disabled={pending} onClick={() => start(() => router.refresh())}>
        {pending ? "Tentando…" : "Tentar de novo"}
      </Button>
    </div>
  )
}

/** The loading state of "Seu dia": the same layout as the card (header, chips, two groups of rows), shown after 200 ms. */
export function SeuDiaSkeleton() {
  return (
    <div aria-hidden className={cn(bentoCardClass(), "page-skeleton flex min-h-[28rem] flex-col gap-4 rounded-[24px] p-5")}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="h-6 w-28 rounded-full bg-muted" />
          <div className="h-4 w-44 rounded-full bg-muted" />
        </div>
        <div className="hidden h-10 w-[220px] rounded-xl bg-muted md:block" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[72, 88, 80, 84, 76].map((w, i) => (
          <div key={i} className="h-11 shrink-0 rounded-full bg-muted md:h-9" style={{ width: w }} />
        ))}
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="size-5 shrink-0 rounded-full bg-muted" />
          <div className="hidden h-4 w-12 rounded-full bg-muted md:block" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-3/5 rounded-full bg-muted" />
            <div className="h-3 w-2/5 rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Card-shaped placeholder for a panel while its data streams in. It only appears after 200 ms (`.page-skeleton`). */
export function PanelSkeleton({ rows = 2, tall }: { rows?: number; tall?: boolean }) {
  return (
    <div aria-hidden className={cn(bentoCardClass(), "page-skeleton flex flex-col gap-4 rounded-[24px] p-5", tall && "min-h-[28rem]")}>
      <div className="h-5 w-32 rounded-full bg-muted" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 w-full rounded-xl bg-muted" />
      ))}
    </div>
  )
}
