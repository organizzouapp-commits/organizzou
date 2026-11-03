"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useThemeChoice, type ThemeChoice } from "@/components/organizzou/use-theme-choice"
import { useMounted } from "@/hooks/use-mounted"

export function AppearanceSettings() {
  const { theme, choose } = useThemeChoice()
  const mounted = useMounted()

  // Before mount the saved choice is unknown, so nothing is shown as selected yet (no flash of the wrong option).
  const current = mounted ? theme : ""
  return (
    <div className="@container flex flex-col gap-5">
      <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">Aparência</h2>
      <p className="max-w-[72ch] text-[15px] leading-6 text-muted-foreground">
        Escolha o tema do app. Claro e Escuro são lembrados neste e nos outros aparelhos da sua conta; Sistema acompanha a configuração de cada aparelho.
      </p>
      <RadioGroup value={current} onValueChange={(value) => choose(value as ThemeChoice)} className="grid gap-4 @min-[560px]:grid-cols-3">
        {(
          [
            ["dark", "Escuro", MoonIcon],
            ["light", "Claro", SunIcon],
            ["system", "Sistema", MonitorIcon],
          ] as const
        ).map(([value, label, Icon]) => (
          <label
            key={value}
            className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-border p-4 transition-colors duration-[400ms] has-data-[state=checked]:border-foreground hover:bg-accent/50 motion-reduce:transition-none"
          >
            <span className="flex min-h-11 items-center gap-3 text-[15px]">
              <RadioGroupItem value={value} />
              <Icon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
              {label}
            </span>
            <span aria-hidden className="flex h-28 overflow-hidden rounded-xl border border-border">
              {(value === "system" ? (["dark", "light"] as const) : ([value] as const)).map((tone) => (
                <span key={tone} className={`flex flex-1 gap-2 p-3 ${tone === "dark" ? "bg-palette-tinta" : "bg-palette-papel"}`}>
                  <span className={`w-1/4 rounded-lg ${tone === "dark" ? "bg-palette-grafite" : "bg-palette-tinta/10"}`} />
                  <span className="flex flex-1 flex-col gap-2">
                    <span className="h-4 w-1/2 rounded-full bg-highlight" />
                    <span className={`h-full rounded-lg ${tone === "dark" ? "bg-palette-grafite" : "bg-palette-tinta/10"}`} />
                  </span>
                </span>
              ))}
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}
