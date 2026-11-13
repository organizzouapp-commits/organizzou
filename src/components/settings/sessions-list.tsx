"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { LaptopIcon, LogOutIcon, SmartphoneIcon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { endOtherSessions, endSession, listSessions } from "@/features/auth/sessions-actions"
import { lastSeenText, type SessionListItem } from "@/features/auth/sessions"

/** "Sessões ativas": every device signed in, this one marked, with "Encerrar" for each other one and "Encerrar todas as outras". */
export function SessionsList() {
  const [state, setState] = useState<{ sessions: SessionListItem[]; managed: boolean } | null>(null)
  const [ending, setEnding] = useState<SessionListItem | "others" | null>(null)
  const [now, setNow] = useState(0)

  const refresh = useCallback(async () => {
    setState(await listSessions().catch(() => ({ sessions: [], managed: false })))
    setNow(Date.now())
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  if (!state) return <div aria-hidden className="h-16 rounded-2xl border border-border" />
  const others = state.sessions.filter((s) => !s.current)

  return (
    <div className="flex flex-col" data-testid="sessions">
      <ul aria-label="Sessões ativas" className="flex flex-col">
        {state.sessions.map((session) => {
          const Icon = /iPhone|iPad|Android/.test(session.label) ? SmartphoneIcon : LaptopIcon
          return (
            <li key={session.id} data-session={session.current ? "current" : session.id} className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 first:pt-0 last:border-b-0">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border">
                <Icon strokeWidth={1.75} className="size-[18px]" />
              </span>
              <div className="flex min-w-0 flex-1 basis-44 flex-col">
                <span className="flex flex-wrap items-center gap-2 text-[15px] leading-6 font-medium">
                  {session.label}
                  {session.current ? <span data-chip="current" className="tabular inline-flex h-6 items-center rounded-full bg-highlight px-2.5 text-[12px] leading-4 font-medium text-highlight-foreground">Este aparelho</span> : null}
                </span>
                <span className="text-[13px] leading-5 text-muted-foreground">
                  {session.place ? `${session.place} · ` : ""}
                  {session.current ? "ativa agora" : `ativa ${lastSeenText(session.lastSeenAt, now)}`} · desde {format(new Date(session.createdAt), "d 'de' MMM", { locale: ptBR })}
                </span>
              </div>
              {session.current ? null : (
                <Button type="button" variant="outline" onClick={() => setEnding(session)} className="h-11 rounded-full md:h-11">
                  <LogOutIcon strokeWidth={1.75} /> Encerrar
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {state.managed && others.length > 0 ? (
        <div className="pt-3">
          <Button type="button" variant="ghost" onClick={() => setEnding("others")} data-testid="end-others" className="h-11 rounded-full px-4 text-muted-foreground">
            Encerrar todas as outras
          </Button>
        </div>
      ) : null}
      {!state.managed ? <p className="pt-2 text-[13px] leading-5 text-muted-foreground">A lista de outros aparelhos ainda não está disponível neste servidor.</p> : null}

      <ConfirmDialog
        open={ending !== null}
        onOpenChange={(open) => !open && setEnding(null)}
        title={ending === "others" ? "Encerrar todas as outras sessões?" : "Encerrar esta sessão?"}
        description={ending === "others" ? "Todos os outros aparelhos saem da sua conta e precisam entrar de novo." : ending ? `“${ending.label}” sai da sua conta e precisa entrar de novo.` : ""}
        confirmLabel="Encerrar"
        onConfirm={async () => {
          const target = ending
          setEnding(null)
          if (!target) return
          const result = target === "others" ? await endOtherSessions() : await endSession(target.id)
          if (!result.ok) return toast.error(result.error)
          toast(target === "others" ? "As outras sessões foram encerradas." : "Sessão encerrada.")
          await refresh()
        }}
      />
    </div>
  )
}
