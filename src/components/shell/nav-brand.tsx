"use client"

import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { Logo } from "@/components/organizzou/Logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { useNav } from "./nav-config"

export const BACK_TO_APP_HREF = "/dashboard"

/** The logo, plus the config's badge ("Admin") when it has one. */
export function NavBrand({ className, logoClassName = "h-8" }: { className?: string; logoClassName?: string }) {
  const nav = useNav()
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo className={logoClassName} />
      {nav.badge ? (
        <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
          {nav.badge}
        </Badge>
      ) : null}
    </span>
  )
}

/** "Voltar ao app" as an outline button (admin header actions and sidebar footer). */
export function BackToAppButton({ className, compactOnNarrow = false }: { className?: string; compactOnNarrow?: boolean }) {
  return (
    <Button asChild variant="outline" size="lg" className={cn("h-11 rounded-full px-3 min-[1280px]:px-5", className)}>
      <Link href={BACK_TO_APP_HREF} aria-label="Voltar ao app">
        <ArrowLeftIcon strokeWidth={1.75} />
        <span className={cn(compactOnNarrow && "hidden min-[1280px]:inline")}>Voltar ao app</span>
      </Link>
    </Button>
  )
}

/** Collapsed rail version: a 44 px round icon button with a tooltip. */
export function BackToAppRail({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={BACK_TO_APP_HREF}
          aria-label="Voltar ao app"
          className={cn("relative flex size-11 shrink-0 items-center justify-center rounded-full text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/50", className)}
        >
          <ArrowLeftIcon aria-hidden strokeWidth={1.75} className="size-5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">Voltar ao app</TooltipContent>
    </Tooltip>
  )
}
