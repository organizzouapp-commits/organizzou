"use client"

import { createContext, useContext } from "react"
import Link from "next/link"
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react"

import { bentoCardClass } from "@/components/organizzou/Bento"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { Progress } from "@/components/ui/progress"
import { statMeta } from "@/features/today/catalog"
import type { StatData } from "@/features/today/types"
import { cn } from "@/lib/utils"

import { useTodayState } from "./today-state"

/** "One Lima KPI per screen": the layout gives the first highlight the highlight tone, whichever stat the person put there. */
const ToneContext = createContext<"default" | "highlight">("default")
export const StatToneProvider = ({ tone, children }: { tone: "default" | "highlight"; children: React.ReactNode }) => <ToneContext.Provider value={tone}>{children}</ToneContext.Provider>

const liters = (ml: number) => `${(ml / 1000).toLocaleString("pt-BR")} L`

/** Applies what the person did on the page (ticks, water) to the numbers the server sent. */
function useLiveNumbers(data: StatData) {
  const { done, postponed, waterMl } = useTodayState()
  const live = data.live
  if (!live) return { value: data.value, support: data.support, progress: data.progress, state: data.state }

  if (live.kind === "tasks") {
    const pending = live.pendingIds.filter((id) => !postponed.has(id))
    const completedNow = pending.filter((id) => done[id]).length
    const planned = live.planned - (live.pendingIds.length - pending.length)
    const doneCount = live.doneBefore + completedNow
    return {
      value: String(pending.length - completedNow),
      support: planned === 0 ? "Nenhuma tarefa para hoje" : `${doneCount} de ${planned} concluídas`,
      // Zero planned tasks never shows a bar, so "0 tasks" can never read as 100%.
      progress: planned === 0 ? undefined : Math.round((doneCount / planned) * 100),
      state: planned === 0 ? ("empty" as const) : data.state,
    }
  }

  if (live.kind === "habits") {
    const doneNow = live.scheduledIds.filter((id) => done[id] ?? live.doneIds.includes(id)).length
    return {
      value: live.total === 0 ? "0" : `${doneNow}/${live.total}`,
      support: live.total === 0 ? "Nenhum hábito para hoje" : "em dia hoje",
      progress: live.total === 0 ? undefined : Math.round((doneNow / live.total) * 100),
      state: data.state,
    }
  }

  const ml = live.ml + waterMl
  return { value: liters(ml), support: `meta ${liters(live.goalMl)}`, progress: Math.min(100, Math.round((ml / live.goalMl) * 100)), state: data.state }
}

/**
 * One highlight card: icon + overline label, hero number, one support line (with an arrow icon for a change), an optional thin
 * progress, and the whole card is a link to its module. Equal height in every layout (h-full).
 */
export function StatCard({ data, tone, className }: { data: StatData; tone?: "default" | "highlight"; className?: string }) {
  const inherited = useContext(ToneContext)
  tone = tone ?? inherited
  const meta = statMeta(data.id)
  const live = useLiveNumbers(data)
  const highlight = tone === "highlight"
  const TrendIcon = data.trend === "down" ? ArrowDownRightIcon : ArrowUpRightIcon
  const muted = highlight ? "text-highlight-foreground/70" : "text-muted-foreground"

  return (
    <Link
      href={data.href}
      aria-label={`${meta?.title}: ${live.value}. ${live.support}`}
      className={cn(bentoCardClass(tone), "group flex h-full min-h-[148px] flex-col gap-2 rounded-[inherit] p-5 outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none", !highlight && "hover:bg-accent", className)}
    >
      <span className={cn("flex items-center gap-2 text-[11px] leading-4 font-semibold tracking-[0.12em] uppercase", muted)}>
        {meta ? <meta.icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" /> : null}
        <span className="min-w-0 flex-1">{meta?.title}</span>
        {live.state === "soon" ? <SoonBadge /> : null}
      </span>
      <span className="tabular text-[34px] leading-10 font-semibold tracking-[-0.02em] break-words">{live.value}</span>
      <span className={cn("tabular flex items-start gap-1.5 text-[13px] leading-5", muted)}>
        {data.trend ? <TrendIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" /> : null}
        <span>{live.support}</span>
      </span>
      {live.progress !== undefined ? <Progress value={live.progress} aria-hidden className={cn("mt-auto h-1.5", highlight && "bg-highlight-foreground/15 [&>[data-slot=progress-indicator]]:bg-highlight-foreground")} /> : <span className="mt-auto" />}
    </Link>
  )
}

/** Same footprint while the card's data streams in (appears after 200 ms, see `.page-skeleton`). */
export function StatCardSkeleton() {
  return (
    <div aria-hidden className={cn(bentoCardClass(), "page-skeleton flex h-full min-h-[148px] flex-col gap-3 p-5")}>
      <div className="h-3 w-24 rounded-full bg-muted" />
      <div className="h-10 w-28 rounded-xl bg-muted" />
      <div className="h-3 w-32 rounded-full bg-muted" />
    </div>
  )
}
