"use client"

import { useState } from "react"
import { PartyPopperIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

import { CANCEL_REASONS, dateBR } from "./plan-model"

/** A dialog on the desktop and a bottom sheet on the phone, with the same title and body. */
export function ResponsiveModal({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: React.ReactNode }) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-[20px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="p-0 pb-3">
            <SheetTitle className="text-[20px] leading-7 font-semibold">{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto rounded-[20px] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[20px] leading-7 font-semibold">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

const UNLOCKED = ["Quadros e listas ilimitados", "Finanças completas", "Assistente com conversa, ações e voz", "Agenda, Rotina, Treinos, Dieta, Estudos, Notas, Metas, Diário e Cofre"]

/** "Pro ativado!": shown once the payment is confirmed. */
export function ProActivatedDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Pro ativado!" description="Obrigado por apoiar o Organizzou. Tudo isto já está liberado:">
      <div className="flex flex-col gap-4" data-testid="pro-activated">
        <span aria-hidden className="grid size-12 place-items-center rounded-full bg-highlight text-highlight-foreground">
          <PartyPopperIcon strokeWidth={1.75} className="size-6" />
        </span>
        <ul className="flex flex-col">
          {UNLOCKED.map((item) => (
            <li key={item} className="min-h-11 border-b border-border py-2.5 text-[15px] leading-6 last:border-b-0">
              {item}
            </li>
          ))}
        </ul>
        <Button type="button" size="lg" className="h-12 rounded-full" onClick={() => onOpenChange(false)}>
          Começar a usar
        </Button>
      </div>
    </ResponsiveModal>
  )
}

/** Cancel at the end of the paid period. The reason is optional, and Pro stays until the end date. */
export function CancelDialog({ open, onOpenChange, endsOn, onCanceled }: { open: boolean; onOpenChange: (open: boolean) => void; endsOn: string | null; onCanceled: () => void }) {
  const [reason, setReason] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reason ? { reason } : {}) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) return void toast.error(data.error ?? "Não consegui cancelar agora. Tente de novo em instantes.")
      toast.success("Assinatura cancelada.")
      onOpenChange(false)
      onCanceled()
    } catch {
      toast.error("Sem conexão. Confira a internet e tente de novo.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Cancelar a assinatura?" description={endsOn ? `Seu Pro continua até ${dateBR(endsOn.slice(0, 10))}. Depois disso o plano volta a ser o Gratuito.` : "Seu Pro continua até o fim do período já pago."}>
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-5 text-muted-foreground">Nada é apagado: seus dados ficam guardados e voltam quando você assinar de novo.</p>
        <div role="group" aria-label="Motivo do cancelamento (opcional)" className="flex flex-wrap gap-2">
          {CANCEL_REASONS.map((item) => (
            <Button key={item} type="button" variant="outline" size="sm" aria-pressed={reason === item} onClick={() => setReason(reason === item ? null : item)} className={cn("rounded-full px-4", reason === item && "border-highlight bg-highlight text-highlight-foreground hover:bg-highlight/90 hover:text-highlight-foreground")}>
              {item}
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" size="lg" className="h-12 rounded-full" onClick={() => onOpenChange(false)}>
            Manter meu Pro
          </Button>
          <Button type="button" size="lg" variant="outline" disabled={busy} className="h-12 rounded-full" onClick={confirm}>
            {busy ? "Cancelando…" : "Cancelar assinatura"}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
