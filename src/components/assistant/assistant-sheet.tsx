"use client"

import { useRouter } from "next/navigation"
import { SparklesIcon } from "lucide-react"

import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type AssistantSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMobile: boolean
  nowIso?: string
}

/**
 * The assistant is "Em breve": there is no AI behind it yet, so this sheet says so instead of answering. Nothing is simulated and
 * nothing is saved here. What works today is the quick capture ("Novo"): it turns a line of text into a real task, spending or note.
 */
export function AssistantSheet({ open, onOpenChange, isMobile }: AssistantSheetProps) {
  const router = useRouter()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={cn("gap-0 p-0", isMobile ? "max-h-[92dvh] rounded-t-[20px]" : "w-full sm:max-w-md")}>
        <SheetHeader className="flex-row items-center gap-3 border-b border-border p-4">
          <SparklesIcon aria-hidden strokeWidth={1.75} className="size-5" />
          <div className="flex flex-col">
            <SheetTitle className="text-[17px] leading-6">Assistente</SheetTitle>
            <SheetDescription className="text-[13px] leading-5">Em breve</SheetDescription>
          </div>
          <SoonBadge className="ml-auto" />
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-[15px] leading-6">
            O assistente com IA ainda não está ligado. Quando estiver, ele vai responder com os seus dados e guardar tarefas, gastos e treinos pela conversa, no app e no WhatsApp.
          </p>
          <p className="text-[15px] leading-6 text-muted-foreground">Por enquanto ele não responde nem salva nada. Para guardar algo agora, use a captura rápida: ela vira uma tarefa, um gasto ou uma nota.</p>
          <Button
            className="h-11 self-start rounded-full px-5"
            onClick={() => {
              onOpenChange(false)
              router.push("/dashboard/notas")
            }}
          >
            Abrir Notas
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
