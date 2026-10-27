import Link from "next/link"
import { MessageCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type WhatsAppCtaProps = { onNavigate?: () => void; className?: string }

/** Lima card that invites the user to link WhatsApp. Radius 20 px, Tinta button on Lima. */
export function WhatsAppCta({ onNavigate, className }: WhatsAppCtaProps) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-[20px] bg-highlight p-4 text-highlight-foreground", className)}>
      <MessageCircleIcon aria-hidden strokeWidth={1.75} className="size-6" />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] leading-5 font-semibold">Conecte seu WhatsApp</p>
        <p className="text-[13px] leading-5 text-highlight-foreground/75">Fale com o assistente e receba lembretes por lá.</p>
      </div>
      <Link
        href="/dashboard/configuracoes?aba=whatsapp"
        onClick={onNavigate}
        className="inline-flex h-9 items-center justify-center self-start rounded-lg bg-palette-tinta px-4 text-sm font-medium text-palette-papel outline-none transition-colors duration-120 hover:bg-palette-tinta/85 focus-visible:ring-3 focus-visible:ring-palette-tinta/40"
      >
        Conectar
      </Link>
    </div>
  )
}
