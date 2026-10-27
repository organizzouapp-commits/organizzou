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

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">Aparência</h2>
      <RadioGroup value={mounted && resolvedTheme === "light" ? "light" : "dark"} onValueChange={changeTheme}>
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <RadioGroupItem value="dark" />
          <MoonIcon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
          Escuro
        </label>
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <RadioGroupItem value="light" />
          <SunIcon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
          Claro
        </label>
      </RadioGroup>
    </div>
  )
}
