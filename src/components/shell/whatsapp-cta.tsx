"use client"

import Link from "next/link"
import { MessageCircleIcon, BadgeDollarSignIcon } from "lucide-react"

import { usePlan } from "@/components/organizzou/plan-context"
import { cn } from "@/lib/utils"

type CardProps = {
  onNavigate?: () => void
  className?: string
}

export const WHATSAPP_HREF = "/dashboard/configuracoes?aba=whatsapp"
export const PLANS_HREF = "/dashboard/plano"

/** Where a "Conectar WhatsApp" entry leads: Pro users to the settings tab, Free users to the plans page (locked). */
export function useWhatsAppAccess() {
  const { canUseWhatsApp, whatsappConnected } = usePlan()
  return { locked: !canUseWhatsApp, connected: whatsappConnected, href: canUseWhatsApp ? WHATSAPP_HREF : PLANS_HREF }
}

const cardClass = "flex flex-col gap-3 rounded-[20px] bg-highlight p-4 text-highlight-foreground [@media(max-height:900px)]:gap-2 [@media(max-height:900px)]:p-3"
const buttonClass =
  "inline-flex h-9 items-center justify-center self-start rounded-lg bg-palette-tinta px-4 text-sm font-medium text-palette-papel outline-none transition-colors duration-120 hover:bg-palette-tinta/85 focus-visible:ring-3 focus-visible:ring-palette-tinta/40"

/**
 * Lima card that invites the user to link WhatsApp. Radius 20 px, Tinta button on Lima.
 * On short screens (<= 900 px tall) the icon and the description are dropped so the card stays complete in the sidebar.
 */
export function WhatsAppCta({ onNavigate, className }: CardProps) {
  return (
    <div className={cn(cardClass, className)}>
      <MessageCircleIcon aria-hidden strokeWidth={1.75} className="size-6 [@media(max-height:900px)]:hidden" />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] leading-5 font-semibold">Conecte seu WhatsApp</p>
        <p className="text-[13px] leading-5 text-highlight-foreground/75 [@media(max-height:900px)]:hidden">Fale com o assistente e receba lembretes por lá.</p>
      </div>
      <Link href={WHATSAPP_HREF} onClick={onNavigate} className={buttonClass}>
        Conectar
      </Link>
    </div>
  )
}

/** Same card, same size and button, for Free users. */
export function UpgradeCta({ onNavigate, className }: CardProps) {
  return (
    <div className={cn(cardClass, className)}>
      <BadgeDollarSignIcon aria-hidden strokeWidth={1.75} className="size-6 [@media(max-height:900px)]:hidden" />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] leading-5 font-semibold">Desbloqueie o Plano Pro</p>
        <p className="text-[13px] leading-5 text-highlight-foreground/75 [@media(max-height:900px)]:hidden">Assistente no WhatsApp, lembretes e muito mais.</p>
      </div>
      <Link href={PLANS_HREF} onClick={onNavigate} className={buttonClass}>
        Fazer upgrade
      </Link>
    </div>
  )
}

/** The card at the bottom of the sidebar: Free -> upgrade, Pro without WhatsApp -> connect, Pro with WhatsApp -> nothing. */
export function SidebarCta({ onNavigate, className }: CardProps) {
  const { canUseWhatsApp, whatsappConnected } = usePlan()
  if (!canUseWhatsApp) return <UpgradeCta onNavigate={onNavigate} className={className} />
  if (whatsappConnected) return null
  return <WhatsAppCta onNavigate={onNavigate} className={className} />
}
