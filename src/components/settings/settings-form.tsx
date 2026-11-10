"use client"

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useThemeChoice, type ThemeChoice } from "@/components/organizzou/use-theme-choice"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "dark", label: "Escuro", hint: "Fundo escuro, com o destaque em Lima.", icon: MoonIcon },
  { value: "light", label: "Claro", hint: "Fundo claro e leve para ambientes iluminados.", icon: SunIcon },
  { value: "system", label: "Sistema", hint: "Segue o claro ou o escuro do aparelho.", icon: MonitorIcon },
] as const satisfies readonly { value: ThemeChoice; label: string; hint: string; icon: typeof MoonIcon }[]

/** A small drawing of the app in one theme (Sistema shows both halves). Decorative. */
function ThemePreview({ value }: { value: ThemeChoice }) {
  return (
    <span aria-hidden className="flex h-28 overflow-hidden rounded-xl border border-border">
      {(value === "system" ? (["dark", "light"] as const) : ([value] as const)).map((tone) => (
        <span key={tone} className={cn("flex flex-1 gap-2 p-3", tone === "dark" ? "bg-palette-tinta" : "bg-palette-papel")}>
          <span className={cn("w-1/4 rounded-lg", tone === "dark" ? "bg-palette-grafite" : "bg-palette-tinta/10")} />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-4 w-1/2 rounded-full bg-highlight" />
            <span className={cn("h-full rounded-lg", tone === "dark" ? "bg-palette-grafite" : "bg-palette-tinta/10")} />
          </span>
        </span>
      ))}
    </span>
  )
}

/** "Tema do app": three selectable cards. The choice applies at once and is saved on this device and on the account (see useThemeChoice). */
export function AppearanceSettings() {
  const { theme, choose } = useThemeChoice()
  const mounted = useMounted()

  // Before mount the saved choice is unknown, so nothing is shown as selected yet (no flash of the wrong option).
  const current = mounted ? theme : ""
  return (
    <div className="@container flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] leading-6 font-semibold">Tema do app</h2>
        <p className="text-[14px] leading-5 text-muted-foreground">Escolha como o Organizzou aparece para você.</p>
      </div>
      <RadioGroup value={current} onValueChange={(value) => choose(value as ThemeChoice)} aria-label="Tema do app" className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-3">
        {THEMES.map(({ value, label, hint, icon: Icon }) => {
          const selected = current === value
          return (
            <label
              key={value}
              data-theme-option={value}
              data-selected={selected}
              className={cn(
                "relative flex cursor-pointer flex-col gap-3 rounded-2xl border-2 p-4 transition-colors duration-[400ms] hover:bg-accent/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 motion-reduce:transition-none",
                selected ? "border-primary bg-highlight/10" : "border-border"
              )}
            >
              <ThemePreview value={value} />
              <span className="flex min-h-11 items-center gap-3">
                <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] leading-6 font-semibold">{label}</span>
                  <span className="text-[13px] leading-5 text-muted-foreground">{hint}</span>
                </span>
                {/* The radio itself stays (keyboard and screen readers); selected, it is covered by a Lima circle with a check. */}
                <span className="relative flex size-6 shrink-0 items-center justify-center">
                  <RadioGroupItem value={value} aria-label={label} className={cn("size-6", selected && "opacity-0")} />
                  {selected ? (
                    <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-highlight text-highlight-foreground">
                      <CheckIcon strokeWidth={2.25} className="size-3.5" />
                    </span>
                  ) : null}
                </span>
              </span>
            </label>
          )
        })}
      </RadioGroup>
      <p className="max-w-[72ch] text-[13px] leading-5 text-muted-foreground">A escolha é salva na sua conta e vale em todos os seus aparelhos. “Sistema” acompanha o claro e o escuro do aparelho.</p>
    </div>
  )
}
