"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpIcon, SparklesIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { UpgradeHint } from "@/components/organizzou/UpgradeHint"
import { usePlan } from "@/components/organizzou/plan-context"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { undoCapture } from "@/features/assistant/actions"
import { cn } from "@/lib/utils"

type AssistantSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMobile: boolean
  nowIso?: string
}

type Action = { label: string; href: string; undo?: { table: string; id: string; restore?: Record<string, unknown> }[] }
type Confirm = { question: string; confirmLabel: string; pending: { tool: string; input: unknown } }
type Message = { id: string; role: "user" | "assistant"; text: string; actions?: Action[]; confirm?: Confirm; choices?: string[]; resolved?: boolean }
type Status = { state: "loading" } | { state: "unavailable"; reason: "not_configured" | "pending_update" } | { state: "ready"; used: number; limit: number }

const UNAVAILABLE: Record<"not_configured" | "pending_update", string> = {
  not_configured: "O assistente com IA ainda não foi ligado neste ambiente. A captura rápida (botão Novo) continua salvando tarefas, gastos e notas.",
  pending_update: "O assistente está esperando uma atualização do banco de dados para ligar. A captura rápida continua funcionando.",
}

const uid = () => crypto.randomUUID()

/**
 * The assistant chat: a sheet with streamed replies, buttons for confirmations and ambiguity, "Desfazer" on what it created, and the
 * day's message counter. When the server has no key (or the usage table is not there yet) it says "Assistente indisponível" and nothing
 * pretends to answer. The conversation is stored per person on the server.
 */
export function AssistantSheet({ open, onOpenChange, isMobile }: AssistantSheetProps) {
  const router = useRouter()
  const { plan } = usePlan()
  const [status, setStatus] = useState<Status>({ state: "loading" })
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    fetch("/api/assistant/chat", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return
        if (!data.available) return setStatus({ state: "unavailable", reason: data.reason === "pending_update" ? "pending_update" : "not_configured" })
        setStatus({ state: "ready", used: data.used ?? 0, limit: data.limit })
        setMessages((data.history ?? []).map((m: { id: string; role: "user" | "assistant"; text: string; actions?: Action[] }) => ({ id: m.id, role: m.role, text: m.text, actions: m.actions })))
      })
      .catch(() => alive && setStatus({ state: "unavailable", reason: "not_configured" }))
    return () => {
      alive = false
    }
  }, [open])

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages])

  const patch = useCallback((id: string, change: (m: Message) => Message) => setMessages((list) => list.map((m) => (m.id === id ? change(m) : m))), [])

  const stream = useCallback(
    async (payload: { message?: string; confirm?: Confirm["pending"] }) => {
      const replyId = uid()
      setBusy(true)
      setMessages((list) => [...list, { id: replyId, role: "assistant", text: "" }])
      try {
        const response = await fetch("/api/assistant/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        if (response.status === 429) {
          const data = await response.json()
          setStatus({ state: "ready", used: data.used, limit: data.limit })
          patch(replyId, (m) => ({ ...m, text: `Você usou as ${data.limit} mensagens de hoje.` }))
          return
        }
        if (!response.ok || !response.body) {
          patch(replyId, (m) => ({ ...m, text: "Assistente indisponível agora. Tente de novo em instantes." }))
          return
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split("\n\n")
          buffer = parts.pop() ?? ""
          for (const part of parts) {
            if (!part.startsWith("data: ")) continue
            const event = JSON.parse(part.slice(6))
            if (event.type === "text") patch(replyId, (m) => ({ ...m, text: m.text + event.delta }))
            else if (event.type === "action") {
              patch(replyId, (m) => ({ ...m, actions: [...(m.actions ?? []), { label: event.label, href: event.href, undo: event.undo }] }))
              router.refresh()
            } else if (event.type === "confirm") patch(replyId, (m) => ({ ...m, text: m.text || event.question, confirm: { question: event.question, confirmLabel: event.confirmLabel, pending: event.pending } }))
            else if (event.type === "choices") patch(replyId, (m) => ({ ...m, text: m.text || event.question, choices: event.choices }))
            else if (event.type === "error") patch(replyId, (m) => ({ ...m, text: m.text || event.message }))
            else if (event.type === "done" && typeof event.used === "number") setStatus({ state: "ready", used: event.used, limit: event.limit })
          }
        }
        router.refresh()
      } catch {
        patch(replyId, (m) => ({ ...m, text: m.text || "Não consegui falar com o assistente. Sua mensagem não foi perdida: tente de novo." }))
      } finally {
        setBusy(false)
      }
    },
    [patch, router]
  )

  function send(text: string) {
    const message = text.trim()
    if (!message || busy) return
    setMessages((list) => [...list, { id: uid(), role: "user", text: message }])
    setDraft("")
    void stream({ message })
  }

  const limitReached = status.state === "ready" && status.used >= status.limit

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={cn("gap-0 p-0", isMobile ? "h-[92dvh] max-h-[92dvh] rounded-t-[20px]" : "w-full sm:max-w-md")}>
        <SheetHeader className="flex-row items-center gap-3 border-b border-border p-4 pr-12">
          <SparklesIcon aria-hidden strokeWidth={1.75} className="size-5" />
          <div className="flex min-w-0 flex-col">
            <SheetTitle className="text-[17px] leading-6">Assistente</SheetTitle>
            <SheetDescription className="text-[13px] leading-5">
              {status.state === "ready" ? `${Math.min(status.used, status.limit)} de ${status.limit} mensagens hoje` : status.state === "loading" ? "Carregando…" : "Indisponível"}
            </SheetDescription>
          </div>
          {messages.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto rounded-full"
              aria-label="Limpar a conversa"
              onClick={async () => {
                const response = await fetch("/api/assistant/chat", { method: "DELETE" })
                if (response.ok) setMessages([])
                else toast.error("Não consegui limpar a conversa.")
              }}
            >
              <Trash2Icon strokeWidth={1.75} />
            </Button>
          ) : null}
        </SheetHeader>

        {status.state === "unavailable" ? (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-[17px] leading-6 font-semibold">Assistente indisponível</p>
            <p className="text-[15px] leading-6 text-muted-foreground">{UNAVAILABLE[status.reason]}</p>
          </div>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4" data-testid="assistant-messages">
              {status.state === "ready" && messages.length === 0 ? (
                <p className="text-[15px] leading-6 text-muted-foreground">Peça do seu jeito: “gastei 45 no mercado”, “o que tenho hoje?”, “conclui a tarefa do relatório”.</p>
              ) : null}
              {messages.map((m) => (
                <div key={m.id} className={cn("flex max-w-[88%] flex-col gap-2", m.role === "user" ? "self-end" : "self-start")}>
                  {m.text || !busy ? (
                    <p className={cn("rounded-2xl px-4 py-2.5 text-[15px] leading-6 whitespace-pre-wrap", m.role === "user" ? "bg-highlight text-highlight-foreground" : "border border-border bg-card")}>{m.text || "…"}</p>
                  ) : (
                    <p className="rounded-2xl border border-border bg-card px-4 py-2.5 text-[15px] leading-6 text-muted-foreground">Pensando…</p>
                  )}
                  {m.actions?.map((a) => (
                    <div key={a.label} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-[13px] leading-5">
                      <Link href={a.href} onClick={() => onOpenChange(false)} className="min-w-0 truncate underline underline-offset-2">
                        {a.label}
                      </Link>
                      {a.undo ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const result = await undoCapture(a.undo!)
                            if (result.ok) {
                              toast("Desfeito.")
                              patch(m.id, (x) => ({ ...x, actions: x.actions?.filter((y) => y !== a) }))
                              router.refresh()
                            } else toast.error("Não consegui desfazer.")
                          }}
                        >
                          Desfazer
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {m.confirm && !m.resolved ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          patch(m.id, (x) => ({ ...x, resolved: true }))
                          void stream({ confirm: m.confirm!.pending })
                        }}
                      >
                        {m.confirm.confirmLabel}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => patch(m.id, (x) => ({ ...x, resolved: true, text: `${x.text} (cancelado)` }))}>
                        Cancelar
                      </Button>
                    </div>
                  ) : null}
                  {m.choices && !m.resolved ? (
                    <div className="flex flex-wrap gap-2">
                      {m.choices.map((choice) => (
                        <Button
                          key={choice}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={busy}
                          onClick={() => {
                            patch(m.id, (x) => ({ ...x, resolved: true }))
                            send(choice)
                          }}
                        >
                          {choice}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              <div ref={end} />
            </div>

            <div className="flex flex-col gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {limitReached ? (
                plan === "pro" ? (
                  <p className="text-[15px] leading-6 text-muted-foreground">Você usou as mensagens de hoje. Elas voltam amanhã.</p>
                ) : (
                  <UpgradeHint limit="assistantMessagesPerDay" used={status.used} />
                )
              ) : null}
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  send(draft)
                }}
              >
                <Textarea
                  aria-label="Mensagem para o assistente"
                  value={draft}
                  disabled={status.state !== "ready" || limitReached}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      send(draft)
                    }
                  }}
                  placeholder="Escreva uma mensagem…"
                  className="max-h-40 min-h-11 resize-none rounded-2xl"
                  rows={1}
                />
                <Button type="submit" size="icon-lg" className="rounded-full" aria-label="Enviar" disabled={!draft.trim() || busy || status.state !== "ready" || limitReached}>
                  <ArrowUpIcon strokeWidth={2} />
                </Button>
              </form>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
