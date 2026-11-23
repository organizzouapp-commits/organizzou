"use client"

import { useState } from "react"
import Link from "next/link"

import { PLANS_HREF } from "@/components/shell/plan-cta"
import { Button } from "@/components/ui/button"
import { PLANS } from "@/lib/plans"

import { ResponsiveModal } from "./plan-dialogs"
import { launchPriceText } from "./plan-model"

export type LimitKind = "lists" | "boards"

const TITLE: Record<LimitKind, string> = {
  lists: `Você usou suas ${PLANS.free.limits.lists} listas`,
  boards: "Você usou seu quadro",
}

/**
 * "Você usou suas 3 listas": shown when the server refuses to create one more list or board on the Free plan.
 * Nothing the person already has is touched. `show(kind)` opens it; render `dialog` once in the screen.
 */
export function usePlanLimitDialog() {
  const [kind, setKind] = useState<LimitKind | null>(null)
  const dialog = (
    <ResponsiveModal open={kind !== null} onOpenChange={(open) => !open && setKind(null)} title={kind ? TITLE[kind] : "Limite do plano"} description="O Plano Gratuito tem 1 quadro e até 3 listas. No Pro são ilimitados.">
      <div className="flex flex-col gap-4" data-testid="plan-limit">
        <p className="text-[15px] leading-6 text-muted-foreground">Seus quadros e listas continuam como estão, e você pode usar e editar todos. Para criar mais, conheça o Pro.</p>
        <div className="flex flex-col gap-2">
          <Button asChild size="lg" className="h-12 rounded-full">
            <Link href={PLANS_HREF}>Experimentar por {launchPriceText()}</Link>
          </Button>
          <Button type="button" size="lg" variant="ghost" className="h-12 rounded-full" onClick={() => setKind(null)}>
            Agora não
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
  return { show: setKind, dialog }
}
