"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type ThemeToggleProps = {
  round?: boolean
  /** Card surface (app top bar). */
  surface?: boolean
  /** Shows "Modo claro" / "Modo escuro" on hover and focus. */
  tooltip?: boolean
  className?: string
}

// Both icons are always rendered and swapped with CSS, so there is no
// hydration mismatch and no flash while next-themes resolves the theme.
export function ThemeToggle({ round = false, surface = false, tooltip = false, className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()

  const button = (
    <Button
      variant={surface ? "surface" : round ? "outline" : "ghost"}
      size="icon"
      className={cn(round && "rounded-full", className)}
      aria-label="Alternar entre tema claro e escuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon strokeWidth={1.75} className="hidden dark:block" />
      <MoonIcon strokeWidth={1.75} className="block dark:hidden" />
    </Button>
  )

  if (!tooltip) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom">
        <span className="hidden dark:inline">Modo claro</span>
        <span className="dark:hidden">Modo escuro</span>
      </TooltipContent>
    </Tooltip>
  )
}
