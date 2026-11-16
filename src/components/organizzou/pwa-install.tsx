"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { DownloadIcon, ShareIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { installPlatform, nextVisitCount, shouldShowInstallBanner, type InstallPlatform } from "@/features/pwa/install"

// The browser's install event, kept for the whole visit so any button can open the real install dialog.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    deferred = event as InstallEvent
    emit()
  })
  window.addEventListener("appinstalled", () => {
    deferred = null
    emit()
  })
}

const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener))

export function useInstall(): { platform: InstallPlatform; standalone: boolean; install: () => Promise<void>; ready: boolean } {
  const has = useSyncExternalStore(subscribe, () => deferred !== null, () => false)
  const [facts, setFacts] = useState<{ userAgent: string; touch: number; standalone: boolean } | null>(null)
  useEffect(() => {
    // The browser facts only exist on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFacts({ userAgent: navigator.userAgent, touch: navigator.maxTouchPoints, standalone: window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true })
  }, [])
  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice.catch(() => undefined)
    deferred = null
    emit()
  }, [])
  if (!facts) return { platform: "other", standalone: true, install, ready: false }
  return { platform: installPlatform({ userAgent: facts.userAgent, maxTouchPoints: facts.touch, hasPromptEvent: has }), standalone: facts.standalone, install, ready: true }
}

const IOS_STEPS = "No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”."

/** The "Instalar app" row of Configurações > Avisos: a real install button where the browser allows it, the iOS how-to on iPhone/iPad, nothing once installed. */
export function InstallRow() {
  const { platform, standalone, install, ready } = useInstall()
  if (!ready) return null
  if (standalone) return <p className="text-[14px] leading-5 text-muted-foreground">O app já está instalado neste aparelho.</p>
  if (platform === "prompt")
    return (
      <div className="flex flex-col gap-2" data-testid="install-row">
        <p className="text-[14px] leading-5 text-muted-foreground">Instale o Organizzou para abrir direto da tela inicial e receber avisos com o app fechado.</p>
        <Button type="button" onClick={() => void install()} data-testid="install-button" className="h-11 rounded-full bg-highlight px-5 text-highlight-foreground hover:bg-highlight/90 md:h-11">
          <DownloadIcon strokeWidth={1.75} /> Instalar app
        </Button>
      </div>
    )
  if (platform === "ios")
    return (
      <p data-testid="install-row" className="flex items-start gap-2 text-[14px] leading-5 text-muted-foreground">
        <ShareIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-semibold text-foreground">Instalar app.</strong> {IOS_STEPS}
        </span>
      </p>
    )
  return <p className="text-[14px] leading-5 text-muted-foreground">Para instalar, abra o menu do navegador e procure “Instalar app” ou “Adicionar à tela inicial”.</p>
}

const VISITS_KEY = "organizzou:visits"
const DISMISSED_KEY = "organizzou:install-dismissed"
const COUNTED_KEY = "organizzou:visit-counted"

/** A dismissible banner from the second visit on (never on the login screen: it is mounted only inside the app). */
export function InstallBanner() {
  const { platform, standalone, install, ready } = useInstall()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ready) return
    try {
      const counted = sessionStorage.getItem(COUNTED_KEY) === "1"
      const stored = Number(localStorage.getItem(VISITS_KEY) ?? "0") || 0
      const visits = nextVisitCount(stored, counted)
      if (!counted) {
        localStorage.setItem(VISITS_KEY, String(visits))
        sessionStorage.setItem(COUNTED_KEY, "1")
      }
      const dismissedRaw = localStorage.getItem(DISMISSED_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(shouldShowInstallBanner({ visits, dismissedAt: dismissedRaw ? Number(dismissedRaw) : null, standalone, platform, now: Date.now() }))
    } catch {
      setVisible(false)
    }
  }, [ready, standalone, platform])
  if (!visible || standalone || platform === "other") return null
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {
      // Private mode: it just comes back next time.
    }
    setVisible(false)
  }
  return (
    <div role="region" aria-label="Instalar o app" data-testid="install-banner" className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 flex items-start gap-3 rounded-[20px] border border-border bg-popover p-4 text-popover-foreground md:right-6 md:bottom-24 md:left-auto md:w-96">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-[15px] leading-5 font-semibold">Instale o Organizzou</p>
        <p className="text-[13px] leading-5 text-muted-foreground">{platform === "ios" ? IOS_STEPS : "Abra direto da tela inicial e receba avisos com o app fechado."}</p>
        {platform === "prompt" ? (
          <Button type="button" onClick={() => void install().then(dismiss)} className="h-11 self-start rounded-full bg-highlight px-5 text-highlight-foreground hover:bg-highlight/90">
            <DownloadIcon strokeWidth={1.75} /> Instalar app
          </Button>
        ) : null}
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label="Agora não" onClick={dismiss} className="size-11 shrink-0 rounded-full">
        <XIcon strokeWidth={1.75} />
      </Button>
    </div>
  )
}
