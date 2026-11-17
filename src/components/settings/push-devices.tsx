"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BellIcon, BellOffIcon, SmartphoneIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { PushDebugPanel, type DebugFacts } from "@/components/settings/push-debug"
import { Button } from "@/components/ui/button"
import { enableMessage, READY_TIMEOUT_MS, sameApplicationServerKey, subscribeErrorMessage, testToast, withTimeout } from "@/features/notifications/enable"
import { getPushPublicKey, listPushDevices, pushDiagnostics, removePushDevice, savePushSubscription, sendTestPush, type PushDevice } from "@/features/notifications/push-actions"
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

type Saved = { endpoint?: string; keys?: { p256dh?: string; auth?: string } }

/** "Notificações neste aparelho": ask permission only on a click, subscribe, list the devices, send a test. Needs the service worker (production). */
export function PushDevices() {
  const [status, setStatus] = useState<Status | null>(null)
  const [devices, setDevices] = useState<PushDevice[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debug, setDebug] = useState(false)
  const [lastTest, setLastTest] = useState<string | null>(null)
  const [lastEnable, setLastEnable] = useState<string | null>(null)
  const resynced = useRef(false)

  /** Saves the subscription this browser already has, when the server does not know it (the device looked "active" but never received anything). */
  const resync = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return false
    const json = subscription.toJSON() as Saved
    const saved = await savePushSubscription({ endpoint: json.endpoint ?? "", keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" }, userAgent: navigator.userAgent, label: deviceLabel(navigator.userAgent) })
    return saved.ok
  }, [])

  const refresh = useCallback(async () => {
    const next = await readStatus()
    setStatus(next)
    const list = await listPushDevices().catch(() => null)
    if (list?.ok) {
      setDevices(list.devices)
      // The browser has a subscription that the server does not have: save it once, so "Ativas neste aparelho" is true on both sides.
      if (next.subscribedHere && next.endpoint && !list.devices.some((d) => d.endpoint === next.endpoint) && !resynced.current) {
        resynced.current = true
        if (await resync().catch(() => false)) {
          const again = await listPushDevices().catch(() => null)
          if (again?.ok) setDevices(again.devices)
        }
      }
    }
  }, [resync])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDebug(new URLSearchParams(window.location.search).get("debug") === "1")
    void refresh()
  }, [refresh])

  async function enable() {
    if (busy) return
    setBusy(true)
    setError(null)
    const stop = (step: Parameters<typeof enableMessage>[0], message?: string) => {
      setLastEnable(step)
      setError(message ?? enableMessage(step))
    }
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return stop("no_service_worker")
      const key = await getPushPublicKey()
      if (!key.ok) {
        setLastEnable(`key_${key.problem}`)
        return setError(key.error)
      }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission()
      if (permission === "denied") {
        await refresh()
        return stop("permission_denied")
      }
      if (permission !== "granted") return stop("permission_dismissed")

      let registration: ServiceWorkerRegistration
      try {
        registration = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }))
        await withTimeout(navigator.serviceWorker.ready, READY_TIMEOUT_MS, "ReadyTimeout")
      } catch (caught) {
        return stop((caught as { name?: string })?.name === "ReadyTimeout" ? "worker_not_ready" : "worker_failed")
      }

      let wanted: Uint8Array<ArrayBuffer>
      try {
        wanted = urlBase64ToUint8Array(key.key)
      } catch {
        return stop("key_unavailable", "A chave de notificações do servidor está em formato inválido. Avise o suporte.")
      }
      let subscription = await registration.pushManager.getSubscription()
      // A subscription made with another public key (the keys were changed) can never be sent to: replace it.
      if (subscription && !sameApplicationServerKey(subscription.options.applicationServerKey, wanted)) {
        await subscription.unsubscribe().catch(() => undefined)
        subscription = null
      }
      if (!subscription) {
        try {
          subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted })
        } catch (caught) {
          const name = (caught as { name?: string })?.name
          setLastEnable(`subscribe_${name ?? "error"}`)
          return setError(subscribeErrorMessage(name))
        }
      }
      const json = subscription.toJSON() as Saved
      const saved = await savePushSubscription({ endpoint: json.endpoint ?? "", keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" }, userAgent: navigator.userAgent, label: deviceLabel(navigator.userAgent) })
      if (!saved.ok) {
        await subscription.unsubscribe().catch(() => undefined)
        return stop("save_failed", saved.error)
      }
      setLastEnable("ok")
      toast.success("Notificações ativadas neste aparelho.")
      await refresh()
    } catch {
      stop("subscribe_failed")
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
    const result = await sendTestPush({ endpoint: status?.endpoint ?? undefined }).catch(() => ({ ok: false as const, reason: "no_session" as const, error: "Não consegui enviar o teste agora." }))
    setBusy(false)
    setLastTest(result.ok ? `ok sent=${result.sent}/${result.devices}` : result.reason)
    const toastInfo = testToast(result)
    if (toastInfo.kind === "success") toast.success(toastInfo.text)
    else toast.error(toastInfo.text)
    // The browser had a subscription the server did not have: save it now, so the next test can reach this device.
    if (!result.ok && result.reason === "device_not_saved") {
      resynced.current = true
      if (await resync().catch(() => false)) await refresh()
    }
  }

  const facts = useCallback(async (): Promise<DebugFacts> => {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    const subscription = await registration?.pushManager.getSubscription()
    const server = await pushDiagnostics({ endpoint: subscription?.endpoint }).catch(() => null)
    return {
      scope: registration?.scope ?? null,
      active: registration?.active?.state ?? null,
      waiting: registration?.waiting?.state ?? null,
      installing: registration?.installing?.state ?? null,
      controlled: "serviceWorker" in navigator ? Boolean(navigator.serviceWorker.controller) : false,
      permission: "Notification" in window ? Notification.permission : "indisponível",
      endpointHost: subscription ? new URL(subscription.endpoint).hostname : null,
      server: server && server.ok ? { configured: server.configured, problem: server.problem, subjectValid: server.subjectValid, devices: server.devices, thisDeviceSaved: server.thisDeviceSaved } : null,
    }
  }, [])

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

      {debug ? <PushDebugPanel load={facts} lastTest={lastTest} lastEnable={lastEnable} /> : null}
    </div>
  )
}
