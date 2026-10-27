import Link from "next/link"
import { MessageCircleIcon } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type WhatsAppCtaProps = {
  onNavigate?: () => void
  className?: string
  /** One-line Lima pill, for sidebars that don't have room for the card. */
  compact?: boolean
  /** Round Lima icon with a tooltip, for the collapsed sidebar rail. */
  iconOnly?: boolean
}

const HREF = "/dashboard/configuracoes?aba=whatsapp"
const focus = "outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50"

/** Lima card that invites the user to link WhatsApp. Radius 20 px, Tinta button on Lima. */
export function WhatsAppCta({ onNavigate, className, compact = false, iconOnly = false }: WhatsAppCtaProps) {
  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={HREF}
            onClick={onNavigate}
            aria-label="Conecte seu WhatsApp"
            className={cn("flex size-11 items-center justify-center rounded-full bg-highlight text-highlight-foreground transition-colors duration-[400ms] hover:bg-highlight/90", focus, className)}
          >
            <MessageCircleIcon aria-hidden strokeWidth={1.75} className="size-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">Conecte seu WhatsApp</TooltipContent>
      </Tooltip>
    )
  }

  if (compact) {
    return (
      <Link
        href={HREF}
        onClick={onNavigate}
        className={cn(
          "flex h-11 items-center gap-3 rounded-full bg-highlight px-4 text-[15px] font-medium text-highlight-foreground transition-colors duration-[400ms] hover:bg-highlight/90",
          focus,
          className
        )}
      >
        <MessageCircleIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
        <span className="truncate">Conecte seu WhatsApp</span>
      </Link>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3 rounded-[20px] bg-highlight p-4 text-highlight-foreground", className)}>
      <MessageCircleIcon aria-hidden strokeWidth={1.75} className="size-6" />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] leading-5 font-semibold">Conecte seu WhatsApp</p>
        <p className="text-[13px] leading-5 text-highlight-foreground/75">Fale com o assistente e receba lembretes por lá.</p>
      </div>
      <Link
        href={HREF}
        onClick={onNavigate}
        className="inline-flex h-9 items-center justify-center self-start rounded-lg bg-palette-tinta px-4 text-sm font-medium text-palette-papel outline-none transition-colors duration-120 hover:bg-palette-tinta/85 focus-visible:ring-3 focus-visible:ring-palette-tinta/40"
      >
        Conectar
      </Link>
    </div>
  )
}
