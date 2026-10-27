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
import { Textarea } from "@/components/ui/textarea"
import { classifyCapture } from "@/mocks/assistant"

type QuickCaptureProps = { open: boolean; onOpenChange: (open: boolean) => void }

const SHORTCUTS = [
  { label: "Nova tarefa", href: "/dashboard/tarefas", module: "tarefas" },
  { label: "Registrar gasto", href: "/dashboard/financas", module: "financas" },
  { label: "Nova nota", href: "/dashboard/notas", module: "notas" },
  { label: "Check-in de humor", href: "/dashboard/diario", module: "diario" },
] as const

export function QuickCapture({ open, onOpenChange }: QuickCaptureProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <QuickCaptureBody onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function QuickCaptureBody({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [text, setText] = useState("")
  const destination = classifyCapture(text)
  const Icon = destination ? modules[destination].icon : null

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        toast.success(destination ? `Salvo em ${modules[destination].name}.` : "Salvo em Notas e lembretes.")
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Captura rápida</DialogTitle>
        <DialogDescription>Escreva do jeito que vier. O assistente escolhe onde guardar.</DialogDescription>
      </DialogHeader>
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
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!text.trim()}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}
