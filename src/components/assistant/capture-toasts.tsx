"use client"

import { useState } from "react"
import Link from "next/link"
import { InboxIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { convertCapture, type CaptureEntry, undoCapture } from "@/features/assistant/actions"
import { type CaptureType, TYPE_LABELS } from "@/server/assistant/parse"

const CONVERT_TO: CaptureType[] = ["tarefa", "gasto", "lembrete", "evento"]

/** "Salvei como nota. Mudar para…": the Inbox note can become a real record in one tap. */
function InboxToast({ id, entry, onDone }: { id: string | number; entry: CaptureEntry; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <div role="status" className="flex w-[min(356px,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-lg">
      <p className="flex items-start gap-2 text-[15px] leading-5">
        <InboxIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-semibold">Salvei como nota.</strong> <span className="text-muted-foreground">Mudar para…</span>
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {CONVERT_TO.map((type) => (
          <Button
            key={type}
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const result = await convertCapture({ noteId: entry.noteId!, type })
              setBusy(false)
              if (!result.ok) return void toast.error(result.error)
              toast.dismiss(id)
              showCaptureToast([result.entry], onDone)
              onDone()
            }}
          >
            {TYPE_LABELS[type]}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" asChild>
          <Link href={entry.href} onClick={() => toast.dismiss(id)}>
            Abrir
          </Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * After saving: what was created ("Tarefa criada: Pagar aluguel · sexta"), a link to open it and "Desfazer" for 8 seconds.
 * Unsure text that went to the Inbox gets the "Mudar para…" toast instead.
 */
export function showCaptureToast(entries: CaptureEntry[], onChanged: () => void) {
  const inbox = entries.filter((e) => e.inbox && e.noteId)
  const others = entries.filter((e) => !(e.inbox && e.noteId))
  for (const entry of inbox) toast.custom((id) => <InboxToast id={id} entry={entry} onDone={onChanged} />, { duration: 12000 })
  if (others.length === 0) return
  const steps = others.flatMap((e) => e.undo)
  const first = others[0]
  toast.success(others.length === 1 ? first.label : `${others.length} itens criados`, {
    duration: 8000,
    description:
      others.length === 1 ? (
        <Link href={first.href} className="underline underline-offset-2">
          Abrir
        </Link>
      ) : (
        <span className="flex flex-col gap-0.5">
          {others.map((e) => (
            <Link key={e.label} href={e.href} className="truncate underline underline-offset-2">
              {e.label}
            </Link>
          ))}
        </span>
      ),
    action: {
      label: "Desfazer",
      onClick: async () => {
        const result = await undoCapture(steps)
        if (result.ok) toast("Desfeito.")
        else toast.error("Não consegui desfazer tudo.")
        onChanged()
      },
    },
  })
}
