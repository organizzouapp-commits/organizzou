"use client"

import { WaitlistForm } from "@/components/site/waitlist-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"

const TITLE = "O pagamento chega em breve"
const DESCRIPTION = "Entre na lista de espera do Plano Pro e avisamos você assim que der para assinar."

/** Pro waiting list: same table and server action as the launch list (tagged "plano-pro"), with the user's data prefilled. */
export function ProWaitlistDialog({ open, onOpenChange, email, name }: { open: boolean; onOpenChange: (open: boolean) => void; email: string; name: string }) {
  const isMobile = useIsMobile()
  const form = open ? (
    <WaitlistForm
      onClose={() => onOpenChange(false)}
      defaults={{ email, name }}
      source="plano-pro"
      submitLabel="Entrar na lista de espera"
      doneTitle="Você está na lista do Plano Pro."
      doneText="Avisamos você por e-mail quando o pagamento estiver disponível. Nenhuma cobrança foi feita."
      alreadyTitle="Anotamos seu interesse no Plano Pro."
      alreadyText="Seu e-mail já estava na lista. Avisamos você quando o pagamento estiver disponível."
    />
  ) : null

  return isMobile ? (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="text-center">
          <DrawerTitle className="text-[24px] leading-8 font-semibold tracking-[-0.02em]">{TITLE}</DrawerTitle>
          <DrawerDescription className="text-sm leading-5">{DESCRIPTION}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{form}</div>
      </DrawerContent>
    </Drawer>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto rounded-[28px] p-8 sm:max-w-[440px]">
        <DialogHeader className="text-center">
          <DialogTitle className="text-[24px] leading-8 font-semibold tracking-[-0.02em]">{TITLE}</DialogTitle>
          <DialogDescription className="text-base leading-6">{DESCRIPTION}</DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  )
}
