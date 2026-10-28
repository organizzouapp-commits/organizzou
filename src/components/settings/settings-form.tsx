"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { updateTheme } from "@/features/settings/actions"
import { useMounted } from "@/hooks/use-mounted"

export function AppearanceSettings() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

  function changeTheme(value: string) {
    setTheme(value)
    void updateTheme(value).then((result) => {
      if (!result.ok) toast.error(result.error)
    })
  }

  const current = mounted && resolvedTheme === "light" ? "light" : "dark"
  return (
    <div className="@container flex flex-col gap-5">
      <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">Aparência</h2>
      <p className="max-w-[72ch] text-[15px] leading-6 text-muted-foreground">Escolha o tema do app. A escolha é lembrada neste e nos outros aparelhos da sua conta.</p>
      <RadioGroup value={current} onValueChange={changeTheme} className="grid gap-4 @min-[560px]:grid-cols-2">
        {(
          [
            ["dark", "Escuro", MoonIcon],
            ["light", "Claro", SunIcon],
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
            <span aria-hidden className={`flex h-28 gap-2 rounded-xl border border-border p-3 ${value === "dark" ? "bg-palette-tinta" : "bg-palette-papel"}`}>
              <span className={`w-1/4 rounded-lg ${value === "dark" ? "bg-palette-grafite" : "bg-palette-tinta/10"}`} />
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-4 w-1/2 rounded-full bg-highlight" />
                <span className={`h-full rounded-lg ${value === "dark" ? "bg-palette-grafite" : "bg-palette-tinta/10"}`} />
              </span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}
