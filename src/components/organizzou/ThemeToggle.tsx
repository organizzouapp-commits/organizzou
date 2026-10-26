"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

// Both icons are always rendered and swapped with CSS, so there is no
// hydration mismatch and no flash while next-themes resolves the theme.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar entre tema claro e escuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon strokeWidth={1.75} className="hidden dark:block" />
      <MoonIcon strokeWidth={1.75} className="block dark:hidden" />
    </Button>
  )
}
