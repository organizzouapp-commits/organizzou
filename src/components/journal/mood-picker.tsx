"use client"

import { useRef } from "react"
import { AngryIcon, FrownIcon, LaughIcon, MehIcon, MinusIcon, MoonIcon, PlusIcon, SmileIcon, type LucideIcon } from "lucide-react"

import { nextMood, sleepText } from "@/features/journal/stats"
import { MOOD_LABELS, type Mood } from "@/features/journal/types"
import { cn } from "@/lib/utils"

export const MOODS: { value: Mood; icon: LucideIcon }[] = [
  { value: 1, icon: AngryIcon },
  { value: 2, icon: FrownIcon },
  { value: 3, icon: MehIcon },
  { value: 4, icon: SmileIcon },
  { value: 5, icon: LaughIcon },
]

export const MOOD_ICONS: Record<Mood, LucideIcon> = { 1: AngryIcon, 2: FrownIcon, 3: MehIcon, 4: SmileIcon, 5: LaughIcon }

/**
 * The five mood buttons as a radio group: one tab stop, the arrow keys (and Home/End) move and select, the chosen one is solid Lima.
 * 80 px tall on desktop, 72 px on phones (the label then drops to 10 px and never wraps).
 */
export function MoodPicker({ value, onChange, label, mobile }: { value: Mood | null; onChange: (mood: Mood) => void; label: string; mobile: boolean }) {
  const refs = useRef<Record<number, HTMLButtonElement | null>>({})
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid grid-cols-5", mobile ? "gap-1.5" : "gap-3")}>
      {MOODS.map(({ value: mood, icon: Icon }) => {
        const on = value === mood
        // The chosen button (or the first one while nothing is chosen) is the tab stop.
        const stop = value === null ? mood === 1 : on
        return (
          <button
            key={mood}
            ref={(el) => {
              refs.current[mood] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={MOOD_LABELS[mood]}
            data-mood={mood}
            tabIndex={stop ? 0 : -1}
            onClick={() => onChange(mood)}
            onKeyDown={(e) => {
              const next = nextMood(value, e.key)
              if (next === null) return
              e.preventDefault()
              onChange(next)
              refs.current[next]?.focus()
            }}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 leading-none outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              mobile ? "h-[72px] text-[10px]" : "h-20 text-[12px]",
              on ? "border-transparent bg-highlight font-semibold text-highlight-foreground" : "border-border bg-muted/40 hover:bg-accent"
            )}
          >
            <Icon aria-hidden strokeWidth={1.75} className="size-6" />
            <span className="max-w-full truncate whitespace-nowrap">{MOOD_LABELS[mood]}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Sleep of the night in half-hour steps, 0 to 14 h: − / value / +, 44 px buttons. */
export function SleepStepper({ value, onChange }: { value: number; onChange: (hours: number) => void }) {
  const button = "relative flex size-11 shrink-0 items-center justify-center rounded-full border border-border outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Horas de sono">
      <button type="button" aria-label="Menos meia hora de sono" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 0.5))} className={button}>
        <MinusIcon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
      <span data-testid="sleep-value" className="tabular w-16 text-center text-[16px] leading-6 font-semibold">
        {sleepText(value)}
      </span>
      <button type="button" aria-label="Mais meia hora de sono" disabled={value >= 14} onClick={() => onChange(Math.min(14, value + 0.5))} className={button}>
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
    </div>
  )
}

/** "Sono de ontem para hoje": the moon, the label and the stepper in one row. */
export function SleepRow({ value, onChange }: { value: number; onChange: (hours: number) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <MoonIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
        <span className="text-[15px] leading-6">Sono de ontem para hoje</span>
      </div>
      <SleepStepper value={value} onChange={onChange} />
    </div>
  )
}

