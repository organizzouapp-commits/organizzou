"use client"

import { useCallback, useEffect, useState } from "react"
import { BellIcon, BellOffIcon, SmartphoneIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { getPushPublicKey, listPushDevices, removePushDevice, savePushSubscription, sendTestPush, type PushDevice } from "@/features/notifications/push-actions"
import { deviceLabel, pushSupport, urlBase64ToUint8Array, type PushSupport } from "@/features/notifications/push"

type Status = { support: PushSupport; subscribedHere: boolean; endpoint: string | null }

const MESSAGES: Record<Exclude<PushSupport, "supported">, { title: string; body: string }> = {
  denied: { title: "Bloqueadas neste navegador", body: "Você bloqueou as notificações. Para liberar, toque no cadeado (ou nos três pontinhos) ao lado do endereço do site, abra “Permissões” ou “Configurações do site”, mude Notificações para “Permitir” e volte aqui." },
  unsupported: { title: "Este navegador não suporta", body: "Tente com o Chrome, o Edge ou o Safari atualizados." },
  "ios-needs-install": { title: "Adicione à Tela de Início primeiro", body: "No iPhone e no iPad as notificações só funcionam no app instalado. No Safari, toque em Compartilhar, escolha “Adicionar à Tela de Início”, abra o Organizzou por lá e volte a esta tela." },
}

/** The browser facts, read where they exist (client only). */
async function readStatus(): Promise<Status> {
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  const support = pushSupport({ hasApis, permission: hasApis ? Notification.permission : "default", userAgent: navigator.userAgent, standalone })
  let endpoint: string | null = null
  if (hasApis) {
    const registration = await navigator.serviceWorker.getRegistration()
    endpoint = (await registration?.pushManager.getSubscription())?.endpoint ?? null
  }
  return { support, subscribedHere: endpoint !== null && Notification.permission === "granted", endpoint }
}

/** "Notificações neste aparelho": ask permission only on a click, subscribe, list the devices, send a test. Needs the service worker (production). */
export function PushDevices() {
  const [status, setStatus] = useState<Status | null>(null)
  const [devices, setDevices] = useState<PushDevice[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setStatus(await readStatus())
    const list = await listPushDevices().catch(() => null)
    if (list?.ok) setDevices(list.devices)
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  async function enable() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const key = await getPushPublicKey()
      if (!key) return setError("As notificações ainda não estão ligadas neste servidor. Avise o suporte.")
      const permission = await Notification.requestPermission()
      if (permission !== "granted") return void (await refresh())
      const registration = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }))
      await navigator.serviceWorker.ready
      const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }))
      const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const saved = await savePushSubscription({ endpoint: json.endpoint ?? "", keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" }, userAgent: navigator.userAgent, label: deviceLabel(navigator.userAgent) })
      if (!saved.ok) {
        await subscription.unsubscribe().catch(() => undefined)
        return setError(saved.error)
      }
      toast.success("Notificações ativadas neste aparelho.")
      await refresh()
    } catch {
      setError("Não consegui ativar as notificações agora. Tente de novo.")
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      const mine = devices.find((d) => d.endpoint === subscription?.endpoint)
      await subscription?.unsubscribe()
      if (mine) await removePushDevice(mine.id)
      toast("Notificações desativadas neste aparelho.")
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function remove(device: PushDevice) {
    const result = await removePushDevice(device.id)
    if (!result.ok) return toast.error(result.error)
    toast("Aparelho removido.")
    await refresh()
  }

  async function test() {
    if (busy) return
    setBusy(true)
    const result = await sendTestPush().catch(() => ({ ok: false as const, error: "Não consegui enviar o teste agora." }))
    setBusy(false)
    if (result.ok) toast.success("Teste enviado. Ele deve chegar em instantes.")
    else toast.error(result.error)
  }

  if (!status) return <div aria-hidden className="h-24 rounded-2xl border border-border" />

  const explain = status.support === "supported" ? null : MESSAGES[status.support]
  return (
    <div className="flex flex-col gap-4" data-testid="push-devices" data-state={status.support === "supported" ? (status.subscribedHere ? "active" : "off") : status.support}>
      {explain ? (
        <div className="flex items-start gap-3 rounded-2xl border border-border p-4 text-[14px] leading-5">
          <BellOffIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{explain.title}</span>
            <span className="text-muted-foreground">{explain.body}</span>
          </div>
        </div>
      ) : status.subscribedHere ? (
        <>
          <p className="flex items-center gap-2 text-[15px] leading-6 font-medium">
            <BellIcon aria-hidden strokeWidth={1.75} className="size-5" /> Ativas neste aparelho
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={test} data-testid="push-test" className="h-11 rounded-full md:h-11">
              Enviar notificação de teste
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={disable} data-testid="push-disable" className="h-11 rounded-full text-muted-foreground md:h-11">
              Desativar
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[14px] leading-5 text-muted-foreground">Receba os avisos que você escolher ao lado, mesmo com o app fechado. O navegador só pergunta quando você tocar no botão.</p>
          <Button type="button" disabled={busy} onClick={enable} data-testid="push-enable" className="h-11 rounded-full bg-highlight px-5 text-highlight-foreground hover:bg-highlight/90 md:h-11">
            <BellIcon strokeWidth={1.75} /> {busy ? "Ativando…" : "Ativar notificações neste aparelho"}
          </Button>
        </>
      )}
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}

      {devices.length > 0 ? (
        <ul aria-label="Aparelhos com notificações" className="flex flex-col">
          {devices.map((device) => (
            <li key={device.id} data-device={device.id} className="flex min-h-12 items-center gap-3 border-t border-border py-1">
              <SmartphoneIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[14px] leading-5">
                {device.label}
                {device.endpoint === status.endpoint ? <span className="ml-2 text-[12px] text-muted-foreground">este aparelho</span> : null}
              </span>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${device.label}`} onClick={() => void remove(device)} className="size-11 rounded-full">
                <Trash2Icon strokeWidth={1.75} />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
