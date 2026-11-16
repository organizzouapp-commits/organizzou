"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { TargetIcon } from "lucide-react"

import { kindGroup, localLinkedGoalRepo, type LinkedGoalMap } from "@/features/goals/linked"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import type { LifeGoalRow } from "@/features/goals/types"

/** "Metas ligadas": the goals of Metas that are fed by this module, one tap away from their page. Shows nothing when there are none. */
export function LinkedGoalsStrip({ group }: { group: "finance" | "habit" | "study" }) {
  const [links, setLinks] = useState<LinkedGoalMap>({})
  const [goals] = usePersistedRows<LifeGoalRow>("life_goals", () => [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinks(localLinkedGoalRepo.load())
  }, [])
  const mine = goals.filter((g) => g.status === "active" && links[g.id] && kindGroup(links[g.id].spec.kind) === group)
  if (mine.length === 0) return null
  return (
    <section aria-label="Metas ligadas" data-testid="linked-goals-strip" className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-[13px] leading-5 text-muted-foreground">
        <TargetIcon aria-hidden strokeWidth={1.75} className="size-4" /> Metas ligadas
      </span>
      {mine.map((g) => (
        <Link key={g.id} href="/dashboard/metas" className="inline-flex min-h-11 max-w-full items-center rounded-full border border-border px-4 text-[13px] leading-5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="truncate">{g.title}</span>
        </Link>
      ))}
    </section>
  )
}
