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

/**
 * Segmented pill with BOTH icons always visible; a Lima thumb slides behind the active one. The position and the icon colors
 * follow the `dark` class on <html> (CSS only), so there is no hydration mismatch and no flash while next-themes resolves.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <button
      type="button"
      aria-label="Alternar entre tema claro e escuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "relative flex h-11 shrink-0 items-center rounded-full border border-border bg-card p-[3px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute top-[3px] left-[3px] size-9 rounded-full bg-highlight transition-transform duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none dark:translate-x-9"
      />
      <span className="relative flex size-9 items-center justify-center text-highlight-foreground transition-colors duration-[400ms] motion-reduce:transition-none dark:text-muted-foreground">
        <SunIcon aria-hidden strokeWidth={1.75} className="size-[18px]" />
      </span>
      <span className="relative flex size-9 items-center justify-center text-muted-foreground transition-colors duration-[400ms] motion-reduce:transition-none dark:text-highlight-foreground">
        <MoonIcon aria-hidden strokeWidth={1.75} className="size-[18px]" />
      </span>
    </button>
  )
}
