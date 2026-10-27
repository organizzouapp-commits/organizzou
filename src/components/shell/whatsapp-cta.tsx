import Link from "next/link"
import { MessageCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type WhatsAppCtaProps = {
  onNavigate?: () => void
  className?: string
}

export const WHATSAPP_HREF = "/dashboard/configuracoes?aba=whatsapp"

/**
 * Lima card that invites the user to link WhatsApp. Radius 20 px, Tinta button on Lima.
 * On short screens (<= 900 px tall) the icon and the description are dropped so the card stays complete in the sidebar.
 */
export function WhatsAppCta({ onNavigate, className }: WhatsAppCtaProps) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-[20px] bg-highlight p-4 text-highlight-foreground [@media(max-height:900px)]:gap-2 [@media(max-height:900px)]:p-3", className)}>
      <MessageCircleIcon aria-hidden strokeWidth={1.75} className="size-6 [@media(max-height:900px)]:hidden" />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] leading-5 font-semibold">Conecte seu WhatsApp</p>
        <p className="text-[13px] leading-5 text-highlight-foreground/75 [@media(max-height:900px)]:hidden">Fale com o assistente e receba lembretes por lá.</p>
      </div>
      <Link
        href={WHATSAPP_HREF}
        onClick={onNavigate}
        className="inline-flex h-9 items-center justify-center self-start rounded-lg bg-palette-tinta px-4 text-sm font-medium text-palette-papel outline-none transition-colors duration-120 hover:bg-palette-tinta/85 focus-visible:ring-3 focus-visible:ring-palette-tinta/40"
      >
        Conectar
      </Link>
    </div>
  )
}
