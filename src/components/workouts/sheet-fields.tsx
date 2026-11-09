"use client"

import { MinusIcon, PlusIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** A text field of the sheets: radius 12, 44 px, a 2 px Lima focus ring (Tinta on Papel, where Lima would vanish). */
export const fieldClass = "h-11 rounded-[12px] px-3 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"

const pillBase = "relative inline-flex h-11 items-center justify-center rounded-full px-3 text-[14px] leading-5 whitespace-nowrap outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] select-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
const pillOn = "bg-highlight font-semibold text-highlight-foreground"
const pillOff = "border border-border hover:bg-accent"

/** The seven weekday toggles (dom..sáb): 44 px high, at least 48 px wide, Lima when on. `value` holds the weekday numbers as strings. */
export function WeekdayPills({ labels, value, onChange }: { labels: string[]; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div role="group" aria-label="Dias da semana" className="flex flex-wrap gap-2">
      {labels.map((label, index) => {
        const id = String(index)
        const on = value.includes(id)
        return (
          <button key={label} type="button" aria-pressed={on} data-weekday={id} onClick={() => onChange(on ? value.filter((v) => v !== id) : [...value, id])} className={cn(pillBase, "min-w-12", on ? pillOn : pillOff)}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

/** − / + around a field you can also type in. The value stays a string so the form keeps its own parsing. */
export function NumberStepper({ id, label, value, onChange, min = 1, max = 99 }: { id: string; label: string; value: string; onChange: (value: string) => void; min?: number; max?: number }) {
  const current = Number(value)
  const step = (direction: 1 | -1) => onChange(String(Math.min(max, Math.max(min, (Number.isFinite(current) && current > 0 ? current : min) + direction))))
  const button = "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" aria-label={`Diminuir ${label.toLowerCase()}`} disabled={current <= min} onClick={() => step(-1)} className={button}>
        <MinusIcon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
      <Input id={id} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))} className={cn(fieldClass, "tabular min-w-0 flex-1 rounded-full px-1 text-center")} />
      <button type="button" aria-label={`Aumentar ${label.toLowerCase()}`} disabled={current >= max} onClick={() => step(1)} className={button}>
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
    </div>
  )
}

export const REST_PRESETS = [
  { seconds: 45, label: "45 s" },
  { seconds: 60, label: "1 min" },
  { seconds: 90, label: "1:30" },
  { seconds: 120, label: "2 min" },
]

/** Rest as preset pills; "Outro" reveals a seconds field. `custom` is true when the value is not a preset (or "Outro" was chosen). */
export function RestPresets({ id, value, custom, onChange, onCustom }: { id: string; value: string; custom: boolean; onChange: (value: string) => void; onCustom: (custom: boolean) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Descanso" className="flex flex-wrap gap-2">
        {REST_PRESETS.map((preset) => {
          const on = !custom && Number(value) === preset.seconds
          return (
            <button
              key={preset.seconds}
              type="button"
              aria-pressed={on}
              onClick={() => {
                onCustom(false)
                onChange(String(preset.seconds))
              }}
              className={cn(pillBase, "tabular min-w-14", on ? pillOn : pillOff)}
            >
              {preset.label}
            </button>
          )
        })}
        <button type="button" aria-pressed={custom} onClick={() => onCustom(true)} className={cn(pillBase, custom ? pillOn : pillOff)}>
          Outro
        </button>
      </div>
      {custom ? (
        <div className="flex items-center gap-2">
          <Input id={id} aria-label="Descanso em segundos" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))} className={cn(fieldClass, "tabular w-28 text-center")} />
          <span className="text-[13px] leading-5 text-muted-foreground">segundos</span>
        </div>
      ) : null}
    </div>
  )
}

/** Buttons that stay in view at the bottom of the dialog or the sheet. */
export function StickyFooter({ children }: { children: React.ReactNode }) {
  return <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex gap-2 bg-popover px-4 pt-3 pb-4 max-md:-mb-[max(1.5rem,env(safe-area-inset-bottom))] max-md:pb-[max(1.5rem,env(safe-area-inset-bottom))] [&>*]:h-11 [&>*]:flex-1 [&>*]:rounded-full">{children}</div>
}
