"use client"

import Link from "next/link"
import { BadgeDollarSignIcon } from "lucide-react"

import { usePlan } from "@/components/organizzou/plan-context"
import { settingsHref } from "@/lib/settings-tabs"

import { AssistantCard } from "./assistant-card"
import { cn } from "@/lib/utils"

type CardProps = {
  onNavigate?: () => void
  className?: string
}

export const PLANS_HREF = settingsHref("plano")

const cardClass = "flex flex-col gap-3 rounded-[20px] bg-highlight p-4 text-highlight-foreground [@media(max-height:900px)]:gap-2 [@media(max-height:900px)]:p-3"
const buttonClass =
  "inline-flex h-9 items-center justify-center self-start rounded-lg bg-palette-tinta px-4 text-sm font-medium text-palette-papel outline-none transition-colors duration-120 hover:bg-palette-tinta/85 focus-visible:ring-3 focus-visible:ring-palette-tinta/40"

/**
 * Lima card that sells the Pro plan (Free users only). Radius 20 px, Tinta button on Lima. On short screens (<= 900 px tall)
 * the icon and the description are dropped so the card stays complete in the sidebar.
 */
export function UpgradeCta({ onNavigate, className }: CardProps) {
  return (
    <div className={cn(cardClass, className)}>
      <BadgeDollarSignIcon aria-hidden strokeWidth={1.75} className="size-6 [@media(max-height:900px)]:hidden" />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] leading-5 font-semibold">Desbloqueie o Plano Pro</p>
        <p className="text-[13px] leading-5 text-highlight-foreground/75 [@media(max-height:900px)]:hidden">Mais limites no assistente, histórico e gráficos sem teto.</p>
      </div>
      <Link href={PLANS_HREF} onClick={onNavigate} className={buttonClass}>
        Fazer upgrade
      </Link>
    </div>
  )
}

/** The slot at the bottom of the sidebar: Free users see the upgrade card, Pro users the virtual assistant. */
export function SidebarCta({ onNavigate, className }: CardProps) {
  const { pro } = usePlan()
  return pro ? <AssistantCard onNavigate={onNavigate} className={className} /> : <UpgradeCta onNavigate={onNavigate} className={className} />
}
