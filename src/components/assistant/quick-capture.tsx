"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MicIcon } from "lucide-react"
import { toast } from "sonner"

import { modules } from "@/components/organizzou/modules"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { captureQuick } from "@/features/assistant/actions"
import { classifyCapture, parseExpense } from "@/mocks/assistant"
import { isMock } from "@/mocks/config"

type QuickCaptureProps = { open: boolean; onOpenChange: (open: boolean) => void }

const SHORTCUTS = [
  { label: "Nova tarefa", href: "/dashboard/tarefas", module: "tarefas" },
  { label: "Registrar gasto", href: "/dashboard/financas", module: "financas" },
  { label: "Nova nota", href: "/dashboard/notas", module: "notas" },
  { label: "Check-in de humor", href: "/dashboard/diario", module: "diario" },
] as const

/** Same form in a dialog (desktop) and in a bottom sheet (mobile). */
const dialogParts = { Header: DialogHeader, Title: DialogTitle, Description: DialogDescription, Footer: DialogFooter }
const sheetParts = { Header: SheetHeader, Title: SheetTitle, Description: SheetDescription, Footer: SheetFooter }

export function QuickCapture({ open, onOpenChange }: QuickCaptureProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-[24px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {open ? <QuickCaptureBody parts={sheetParts} onClose={() => onOpenChange(false)} /> : null}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <QuickCaptureBody parts={dialogParts} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function QuickCaptureBody({ parts, onClose }: { parts: typeof dialogParts | typeof sheetParts; onClose: () => void }) {
  const { Header, Title, Description, Footer } = parts
  const router = useRouter()
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)
  const guessed = classifyCapture(text)
  // Where the text really ends up: only tasks and spendings have a home of their own for now; the rest is kept as a note.
  const destination = isMock ? guessed : guessed === "tarefas" ? "tarefas" : guessed === "financas" && parseExpense(text) ? "financas" : text.trim() ? "notas" : null
  const Icon = destination ? modules[destination].icon : null

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        if (isMock) {
          toast(destination ? `Prévia: isto iria para ${modules[destination].name}, mas ainda não é salvo.` : "Prévia: isto iria para Notas e lembretes, mas ainda não é salvo.")
          onClose()
          return
        }
        setSaving(true)
        void captureQuick({ text }).then((result) => {
          setSaving(false)
          if (!result.ok) {
            // Stay open with the text, so nothing the person wrote is lost.
            toast.error(result.error)
            return
          }
          const label = { tarefa: "Tarefa criada.", gasto: "Gasto registrado.", nota: "Guardado em Notas." }[result.saved]
          toast.success(label, { action: { label: "Abrir", onClick: () => router.push(result.href) } })
          onClose()
          router.refresh()
        })
      }}
    >
      <Header className="p-0">
        <Title>Captura rápida</Title>
        <Description>{isMock ? "Prévia: escreva do jeito que vier e veja onde o assistente guardaria. Ainda não salva nada." : "Escreva do jeito que vier: vira tarefa, gasto ou nota, e fica salvo."}</Description>
      </Header>
      <div className="flex gap-2">
        <Textarea
          autoFocus
          aria-label="O que você quer registrar?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex.: pagar o aluguel sexta, gastei 45 no mercado…"
          className="min-h-24"
        />
        <Button type="button" variant="outline" size="icon-lg" aria-label="Gravar áudio" onClick={() => setText("estudei 1 hora de estatística")}>
          <MicIcon strokeWidth={1.75} />
        </Button>
      </div>
      <p className="flex min-h-6 items-center gap-2 text-[15px] leading-6" aria-live="polite">
        {Icon && destination ? (
          <>
            <Icon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
            Vai para <strong className="font-semibold">{modules[destination].name}</strong>
          </>
        ) : text.trim() ? (
          <span className="text-muted-foreground">Vai para Notas e lembretes</span>
        ) : (
          <span className="text-muted-foreground">Comece a escrever para ver o destino.</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {SHORTCUTS.map((s) => (
          <Button
            key={s.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onClose()
              router.push(s.href)
            }}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <Footer className="p-0">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!text.trim() || saving}>
          Salvar
        </Button>
      </Footer>
    </form>
  )
}
