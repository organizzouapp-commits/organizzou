"use client"

import { DropletsIcon, MinusIcon } from "lucide-react"

import { BentoCard } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { HatchedProgress, HeroCard } from "@/components/finance/parts"
import { HATCH_STYLE } from "@/components/habits/hoje-tab"
import { type Macros } from "@/features/diet/stats"
import { filledPips, kcalText, litersText, macroPercent, remainingKcal, waterPips } from "@/features/diet/summary"
import type { DietGoalRow } from "@/features/diet/types"
import { cn } from "@/lib/utils"

const chip = "tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"

// ------------------------------------------------------------------ summary row

export function SummaryRow({ isMobile, totals, goal, water, glassMl, onAddWater, onRemoveWater }: { isMobile: boolean; totals: Macros; goal: DietGoalRow; water: number; glassMl: number; onAddWater: () => void; onRemoveWater: () => void }) {
  const left = remainingKcal(totals.kcal, goal.kcal)
  const height = isMobile ? undefined : "h-[216px]"
  const macros = [
    { label: "Proteína", value: totals.protein, goal: goal.protein_g },
    { label: "Carboidrato", value: totals.carbs, goal: goal.carbs_g },
    { label: "Gordura", value: totals.fat, goal: goal.fat_g },
  ]
  const pips = waterPips(goal.water_ml)
  const filled = filledPips(water, goal.water_ml)

  const hero = (
    <HeroCard
      key="hero"
      className={height}
      density={isMobile ? "default" : "dense"}
      label="Calorias de hoje"
      value={
        <>
          {kcalText(left.value)}
          <span className="ml-1.5 text-[16px] leading-6 font-medium tracking-normal opacity-60">{left.over ? "kcal acima" : "kcal restam"}</span>
        </>
      }
      support={`${kcalText(totals.kcal)} de ${kcalText(goal.kcal)} kcal consumidas`}
      progress={{ value: macroPercent(totals.kcal, goal.kcal), label: "Calorias consumidas do dia" }}
    />
  )
  const macrosCard = (
    <BentoCard key="macros" title="Macros" data-testid="diet-macros" className={cn(height, "md:gap-2 md:p-4")} actions={<span data-chip className={chip}>meta do dia</span>}>
      <ul className="flex flex-col gap-3">
        {macros.map((m) => (
          <li key={m.label} className="flex flex-col gap-1.5">
            <div className="tabular flex items-baseline justify-between gap-2 text-[13px] leading-5">
              <span>{m.label}</span>
              <span className="text-muted-foreground">
                <span className="font-bold text-foreground">{Math.round(m.value)}</span> / {m.goal} g
              </span>
            </div>
            <HatchedProgress value={macroPercent(m.value, m.goal)} label={`${m.label} do dia`} />
          </li>
        ))}
      </ul>
    </BentoCard>
  )
  const waterCard = (
    <BentoCard key="water" title="Água" data-testid="diet-water" className={cn(height, "md:p-4")} actions={<span data-chip className={chip}>meta: {litersText(goal.water_ml)} L</span>}>
      <div className="flex flex-col gap-3">
        <p className="tabular flex items-baseline gap-1.5 text-[30px] leading-9 font-semibold tracking-[-0.02em]">
          {litersText(water)}
          <span className="text-[13px] leading-5 font-normal text-muted-foreground">L de {litersText(goal.water_ml)} L</span>
        </p>
        <div role="img" aria-label={`Água: ${litersText(water)} de ${litersText(goal.water_ml)} litros`} data-testid="water-pips" className="flex gap-1">
          {Array.from({ length: pips.count }, (_, i) => (
            <span key={i} data-pip={i < filled ? "on" : "off"} className={cn("h-2.5 min-w-0 flex-1 rounded-full", i < filled ? "bg-primary" : "border border-foreground/20")} style={i < filled ? undefined : HATCH_STYLE} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label={`Remover ${glassMl} ml`} disabled={water <= 0} onClick={onRemoveWater} className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-border outline-none transition-colors duration-[400ms] after:absolute after:-inset-0.5 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none">
            <MinusIcon aria-hidden strokeWidth={1.75} className="size-4" />
          </button>
          <button type="button" data-testid="add-water" onClick={onAddWater} className="relative inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-highlight px-3 text-[14px] leading-5 font-semibold text-highlight-foreground outline-none transition-colors duration-[400ms] after:absolute after:-inset-0.5 hover:bg-highlight/90 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none">
            <DropletsIcon aria-hidden strokeWidth={1.75} className="size-4" /> + {glassMl} ml
          </button>
        </div>
      </div>
    </BentoCard>
  )

  if (isMobile) {
    return (
      <FinanceDeck
        title={null}
        label="Resumo do dia"
        noun="resumo"
        initialHeight={216}
        slides={[
          { id: "hero", hero: true, node: hero },
          { id: "macros", node: macrosCard },
          { id: "water", node: waterCard },
        ]}
      />
    )
  }
  return (
    <div data-testid="diet-summary" className="grid grid-cols-12 gap-4">
      <div className="col-span-4 flex min-w-0 flex-col [&>*]:flex-1">{hero}</div>
      <div className="col-span-5 min-w-0">{macrosCard}</div>
      <div className="col-span-3 min-w-0">{waterCard}</div>
    </div>
  )
}

