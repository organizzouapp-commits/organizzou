"use client"

import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

export type DebugFacts = {
  scope: string | null
  active: string | null
  waiting: string | null
  installing: string | null
  controlled: boolean
  permission: string
  /** Only the host of the push endpoint (e.g. fcm.googleapis.com). */
  endpointHost: string | null
  server: { configured: boolean; problem: string | null; subjectValid: boolean; devices: number; thisDeviceSaved: boolean | null } | null
}

type WorkerEvent = { stage: string; detail: string | null; at: number }

const yes = (value: boolean | null | undefined) => (value === null || value === undefined ? "?" : value ? "sim" : "não")

/**
 * Notificações > diagnóstico, only with ?debug=1 on the Avisos tab: the state of the service worker, the permission, the host of this
 * device's push endpoint, what the server knows, and the last test and last push seen by the worker. No keys, no endpoints, no tokens.
 */
export function PushDebugPanel({ load, lastTest, lastEnable }: { load: () => Promise<DebugFacts>; lastTest: string | null; lastEnable: string | null }) {
  const [facts, setFacts] = useState<DebugFacts | null>(null)
  const [worker, setWorker] = useState<WorkerEvent | null>(null)

  const refresh = useCallback(async () => setFacts(await load().catch(() => null)), [load])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    if (!("serviceWorker" in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; stage?: string; detail?: string | null; at?: number } | null
      if (data?.type === "ORG_PUSH" && data.stage) setWorker({ stage: data.stage, detail: data.detail ?? null, at: data.at ?? Date.now() })
    }
    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [refresh])

  const rows: [string, string][] = facts
    ? [
        ["Service worker (escopo)", facts.scope ?? "não registrado"],
        ["Estados (ativo / esperando / instalando)", `${facts.active ?? "—"} / ${facts.waiting ?? "—"} / ${facts.installing ?? "—"}`],
        ["Controla esta página", yes(facts.controlled)],
        ["Permissão do navegador", facts.permission],
        ["Inscrição neste aparelho (host)", facts.endpointHost ?? "nenhuma"],
        ["Servidor com as chaves certas", facts.server ? `${yes(facts.server.configured)}${facts.server.problem ? ` (${facts.server.problem})` : ""}` : "?"],
        ["Assunto VAPID válido", yes(facts.server?.subjectValid)],
        ["Aparelhos salvos na conta", facts.server ? String(facts.server.devices) : "?"],
        ["Este aparelho está salvo", yes(facts.server?.thisDeviceSaved)],
        ["Última tentativa de ativar", lastEnable ?? "—"],
        ["Último teste", lastTest ?? "—"],
        ["Último push visto pelo service worker", worker ? `${worker.stage}${worker.detail ? ` (${worker.detail})` : ""} às ${new Date(worker.at).toLocaleTimeString("pt-BR")}` : "nenhum nesta página"],
      ]
    : []

  return (
    <section aria-label="Diagnóstico das notificações" data-testid="push-debug" className="flex flex-col gap-2 rounded-2xl border border-dashed border-border p-3 text-[12px] leading-5">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-[13px] font-semibold">Diagnóstico (debug=1)</strong>
        <Button type="button" variant="outline" onClick={() => void refresh()} className="h-11 rounded-full px-4 text-[13px]">
          Atualizar
        </Button>
      </div>
      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1">
        {rows.map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="text-muted-foreground">{name}</dt>
            <dd className="tabular break-words font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
