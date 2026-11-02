"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { TriangleAlertIcon } from "lucide-react"

import { bentoCardClass } from "@/components/organizzou/Bento"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** A widget whose data failed to load. It stays inside its own card: the rest of the page keeps working. */
export function WidgetError({ title, compact }: { title: string; compact?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div role="alert" className={cn(bentoCardClass(), "flex h-full flex-col justify-center gap-3 rounded-[24px] p-5", compact && "min-h-[148px]")}>
      <p className="flex items-start gap-3 text-[15px] leading-6">
        <TriangleAlertIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
        <span>Não foi possível carregar “{title}”.</span>
      </p>
      <Button type="button" variant="outline" className="h-11 self-start rounded-full px-5" disabled={pending} onClick={() => start(() => router.refresh())}>
        {pending ? "Tentando…" : "Tentar de novo"}
      </Button>
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
