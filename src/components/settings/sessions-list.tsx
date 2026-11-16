"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { LaptopIcon, LogOutIcon, SmartphoneIcon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { SettingRow } from "@/components/settings/setting-row"
import { Button } from "@/components/ui/button"
import { endOtherSessions, endSession, listSessions, type SessionsStatus } from "@/features/auth/sessions-actions"
import { lastSeenText, type SessionListItem } from "@/features/auth/sessions"

/** "Sessões ativas": every device signed in, this one marked, with "Encerrar" for each other one and "Encerrar todas as outras". */
export function SessionsList() {
  const [state, setState] = useState<{ sessions: SessionListItem[]; status: SessionsStatus } | null>(null)
  const [ending, setEnding] = useState<SessionListItem | "others" | null>(null)
  const [now, setNow] = useState(0)

  const refresh = useCallback(async () => {
    setState(await listSessions().catch(() => ({ sessions: [], status: "error" as const })))
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
            <li key={session.id} data-session={session.current ? "current" : session.id} className="list-none">
              <SettingRow
                interactive
                icon={Icon}
                title={session.label}
                badge={session.current ? <span data-chip="current" className="tabular inline-flex h-6 items-center rounded-full bg-highlight px-2.5 text-[12px] leading-4 font-medium text-highlight-foreground">Este aparelho</span> : null}
                description={
                  <>
                    {session.place ? `${session.place} · ` : ""}
                    {session.current ? "ativa agora" : `ativa ${lastSeenText(session.lastSeenAt, now)}`} · desde {format(new Date(session.createdAt), "d 'de' MMM", { locale: ptBR })}
                  </>
                }
                fullWidthControlsOnMobile
              >
                {session.current ? null : (
                  <Button type="button" variant="outline" onClick={() => setEnding(session)} className="h-11 rounded-full md:h-11">
                    <LogOutIcon strokeWidth={1.75} /> Encerrar
                  </Button>
                )}
              </SettingRow>
            </li>
          )
        })}
      </ul>
      {state.status === "ok" && others.length > 0 ? (
        <div className="pt-3">
          <Button type="button" variant="ghost" onClick={() => setEnding("others")} data-testid="end-others" className="h-11 rounded-full px-4 text-muted-foreground">
            Encerrar todas as outras
          </Button>
        </div>
      ) : null}
      {state.status === "missing" ? (
        <p data-testid="sessions-missing" className="mt-3 rounded-2xl border border-border p-4 text-[13px] leading-5 text-muted-foreground">
          <strong className="font-semibold text-foreground">Só este aparelho aparece porque o registro de sessões ainda não foi ativado no banco de dados.</strong> Falta aplicar a migration{" "}
          <code className="font-mono">20261112000008_user_sessions.sql</code>. Depois disso, cada aparelho em que você entrar passa a aparecer aqui e pode ser encerrado.
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] leading-5 text-muted-foreground">
          Não consegui carregar a lista de aparelhos agora.
          <Button type="button" variant="outline" onClick={() => void refresh()} className="h-11 rounded-full">
            Tentar de novo
          </Button>
        </p>
      ) : null}

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
