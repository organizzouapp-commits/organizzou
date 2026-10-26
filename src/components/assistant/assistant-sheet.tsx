"use client"

import { useEffect, useRef, useState } from "react"
import {
  CheckIcon,
  CircleAlertIcon,
  MicIcon,
  SendHorizontalIcon,
  SparklesIcon,
  SquareIcon,
  Undo2Icon,
} from "lucide-react"

import { modules } from "@/components/organizzou/modules"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { AssistantAction, AssistantReply, ChatMessage } from "@/features/assistant/types"
import { assistantSuggestions, buildReply } from "@/mocks/assistant"
import { mockId } from "@/mocks/time"
import { cn } from "@/lib/utils"

type AssistantSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMobile: boolean
  nowIso: string
}

const GREETING: AssistantReply = {
  text: "Oi! Eu registro tarefas, gastos, treinos, refeições e estudos por texto ou áudio, e respondo perguntas sobre os seus dados. O que você quer fazer?",
}

const VOICE_SAMPLES = ["gastei 80 de gasolina", "adiciona tarefa ligar para o contador amanhã", "estudei 1 hora de estatística", "me lembra de levar o carro na revisão"]

function ActionCard({ action, resolved, onUndo }: { action: AssistantAction; resolved?: string; onUndo: () => void }) {
  const Icon = modules[action.module].icon
  return (
    <div className="flex items-center gap-3 border-y border-border py-3">
      <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 text-[13px] leading-5 font-medium">
          <CheckIcon aria-hidden strokeWidth={2} className="size-3.5" />
          {resolved === "undone" ? "Desfeito" : action.title}
        </span>
        <span className={cn("truncate text-[13px] leading-5 text-muted-foreground", resolved === "undone" && "line-through")}>{action.detail}</span>
      </div>
      {action.undoable && resolved !== "undone" ? (
        <Button variant="ghost" size="sm" onClick={onUndo}>
          <Undo2Icon strokeWidth={1.75} /> Desfazer
        </Button>
      ) : null}
    </div>
  )
}

export function AssistantSheet({ open, onOpenChange, isMobile, nowIso }: AssistantSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{ id: "greeting", role: "assistant", reply: GREETING }])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages, thinking])

  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [recording])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((id) => window.clearTimeout(id))
  }, [])

  function reply(to: string, audioSeconds?: number) {
    const text = to.trim()
    if (!text || thinking) return
    setMessages((current) => [...current, { id: mockId("msg"), role: "user", text, audioSeconds }])
    setInput("")
    setThinking(true)
    timers.current.push(
      window.setTimeout(() => {
        setMessages((current) => [...current, { id: mockId("msg"), role: "assistant", reply: buildReply(text, nowIso) }])
        setThinking(false)
      }, 700)
    )
  }

  function toggleRecording() {
    if (recording) {
      // Stopping the recording "transcribes" a sample sentence and sends it, like the voice flow will.
      const sample = VOICE_SAMPLES[seconds % VOICE_SAMPLES.length]
      setRecording(false)
      reply(sample, Math.max(seconds, 2))
      setSeconds(0)
      return
    }
    setSeconds(0)
    setRecording(true)
  }

  function resolve(id: string, resolved: "confirmed" | "cancelled" | "undone", followUp?: AssistantReply) {
    setMessages((current) => {
      const next = current.map((m) => (m.id === id && m.role === "assistant" ? { ...m, resolved } : m))
      return followUp ? [...next, { id: mockId("msg"), role: "assistant" as const, reply: followUp }] : next
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={cn("gap-0 p-0", isMobile ? "h-[92dvh] rounded-t-[20px]" : "w-full sm:max-w-md")}>
        <SheetHeader className="flex-row items-center gap-3 border-b border-border p-4">
          <SparklesIcon aria-hidden strokeWidth={1.75} className="size-5" />
          <div className="flex flex-col">
            <SheetTitle className="text-[17px] leading-6">Assistente</SheetTitle>
            <SheetDescription className="text-[13px] leading-5">Registra e responde em segundos</SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-4" aria-live="polite">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex flex-col items-end gap-1">
                  {m.audioSeconds ? (
                    <span className="tabular flex items-center gap-1.5 text-[13px] leading-5 text-muted-foreground">
                      <MicIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> Áudio · 0:{String(m.audioSeconds).padStart(2, "0")}
                    </span>
                  ) : null}
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-[15px] leading-6">{m.text}</p>
                </div>
              ) : (
                <div key={m.id} className="flex max-w-[92%] flex-col gap-3">
                  <p className="text-[15px] leading-6">{m.reply.text}</p>
                  {m.reply.rows ? (
                    <dl className="flex flex-col border-y border-border">
                      {m.reply.rows.map((row, index) => (
                        <div key={index} className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
                          <dt className="tabular text-[13px] leading-5 text-muted-foreground">{row.label}</dt>
                          <dd className="tabular text-right text-[15px] leading-6">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {m.reply.action ? (
                    <ActionCard action={m.reply.action} resolved={m.resolved} onUndo={() => resolve(m.id, "undone")} />
                  ) : null}
                  {m.reply.confirm ? (
                    <div className="flex flex-col gap-3 border-y border-border py-3">
                      <p className="flex items-start gap-2 text-[15px] leading-6">
                        <CircleAlertIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
                        {m.reply.confirm.question}
                      </p>
                      {m.resolved ? (
                        <p className="text-[13px] leading-5 text-muted-foreground">{m.resolved === "confirmed" ? "Confirmado." : "Cancelado. Nada foi alterado."}</p>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="destructive" size="sm" onClick={() => {
                              const outcome = m.reply.confirm?.onConfirm
                              resolve(m.id, "confirmed", outcome ? { text: outcome.reply, action: outcome.action } : undefined)
                            }}>
                            {m.reply.confirm.confirmLabel}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => resolve(m.id, "cancelled", { text: "Tudo bem, não apaguei nada." })}>
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {m.reply.choices && !m.resolved ? (
                    <div className="flex flex-wrap gap-2">
                      {m.reply.choices.map((choice) => (
                        <Button key={choice} variant="outline" size="sm" className="h-auto min-h-9 rounded-full py-1.5 whitespace-normal" onClick={() => { resolve(m.id, "confirmed"); reply(choice) }}>
                          {choice}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            )}
            {thinking ? (
              <div className="flex gap-1.5" role="status" aria-label="O assistente está escrevendo">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-2 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        <div className="flex flex-col gap-3 border-t border-border p-4">
          {messages.length <= 1 ? (
            <div className="flex flex-wrap gap-2">
              {assistantSuggestions.map((s) => (
                <Button key={s} variant="outline" size="sm" className="h-auto min-h-9 rounded-full py-1.5 whitespace-normal" onClick={() => reply(s)}>
                  {s}
                </Button>
              ))}
            </div>
          ) : null}
          {recording ? (
            <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3" role="status">
              <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-foreground" />
              <span className="tabular flex-1 text-[15px] leading-6">Gravando… 0:{String(seconds).padStart(2, "0")}</span>
              <Button size="sm" onClick={toggleRecording}>
                <SquareIcon strokeWidth={1.75} /> Enviar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRecording(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                reply(input)
              }}
            >
              <Textarea
                aria-label="Mensagem para o assistente"
                value={input}
                rows={1}
                placeholder="Escreva ou fale com o assistente"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    reply(input)
                  }
                }}
                className="max-h-32 min-h-11 resize-none py-2.5"
              />
              <Button type="button" variant="outline" size="icon-lg" aria-label="Gravar áudio" onClick={toggleRecording}>
                <MicIcon strokeWidth={1.75} />
              </Button>
              <Button type="submit" size="icon-lg" aria-label="Enviar" disabled={!input.trim() || thinking}>
                <SendHorizontalIcon strokeWidth={1.75} />
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
