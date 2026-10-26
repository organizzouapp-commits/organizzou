"use client"

import { useEffect, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import {
  acceptAll,
  consentSnapshot,
  hasConsent,
  OPEN_PREFERENCES_EVENT,
  parseConsentSnapshot,
  rejectOptional,
  saveConsent,
  subscribeConsent,
  type ConsentCategory,
} from "./consent"

// Same 0.4 s movement as the auth screens (DESIGN-SYSTEM §5.3).
const motion =
  "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"

const CATEGORIES = [
  { key: "necessary", label: "Essenciais", hint: "Mantêm você conectado e guardam suas preferências. Sempre ativos." },
  { key: "analytics", label: "Análise", hint: "Mostram como o app é usado, de forma agregada, para melhorarmos o Organizzou." },
  { key: "marketing", label: "Marketing", hint: "Medem campanhas e personalizam comunicações fora do app." },
] as const

/** undefined = not read yet (server render and first client render), so the bar never flashes for returning visitors. */
function useStoredConsent() {
  const raw = useSyncExternalStore(subscribeConsent, consentSnapshot, () => undefined)
  return raw === undefined ? undefined : parseConsentSnapshot(raw)
}

type CookieConsentProps = {
  /** Where the "Política de privacidade" link points. */
  privacyHref?: string
}

/**
 * LGPD cookie bar: shows once per browser, until the choice is stored or CONSENT_VERSION changes.
 * Mount it once in the root layout. Self-contained: only the shadcn Button, Dialog and Switch are used.
 */
export function CookieConsent({ privacyHref = "/privacidade" }: CookieConsentProps) {
  const stored = useStoredConsent()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ analytics: false, marketing: false })

  useEffect(() => {
    function openPreferences() {
      const current = parseConsentSnapshot(consentSnapshot())
      setDraft({ analytics: current?.analytics ?? false, marketing: current?.marketing ?? false })
      setOpen(true)
    }
    window.addEventListener(OPEN_PREFERENCES_EVENT, openPreferences)
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, openPreferences)
  }, [])

  const showBar = stored === null

  return (
    <>
      {showBar ? (
        <div
          role="region"
          aria-label="Aviso de cookies"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex justify-center sm:inset-x-4 sm:bottom-4",
            "animate-in duration-[400ms] fade-in slide-in-from-bottom-4 motion-reduce:animate-none"
          )}
        >
          <div
            className={cn(
              "flex w-full max-w-[720px] flex-col gap-4 rounded-t-[20px] border border-border bg-popover p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-popover-foreground sm:rounded-[20px] sm:pb-5",
              "sm:flex-row sm:items-center sm:gap-5"
            )}
          >
            <p className="flex-1 text-[14px] leading-5">
              Usamos cookies essenciais para o Organizzou funcionar e, com a sua permissão, cookies de análise para melhorar o app.{" "}
              <a href={privacyHref} className={cn("rounded-sm underline underline-offset-4 outline-none hover:underline-offset-[6px] focus-visible:ring-3 focus-visible:ring-ring/50", motion)}>
                Política de privacidade
              </a>
            </p>
            <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
              <Button className={motion} onClick={acceptAll}>
                Aceitar todos
              </Button>
              <Button variant="outline" className={motion} onClick={rejectOptional}>
                Recusar opcionais
              </Button>
              <Button
                variant="ghost"
                className={motion}
                onClick={() => {
                  setDraft({ analytics: false, marketing: false })
                  setOpen(true)
                }}
              >
                Personalizar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preferências de cookies</DialogTitle>
            <DialogDescription>Escolha quais cookies opcionais podemos usar. Você pode mudar isso quando quiser.</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col">
            {CATEGORIES.map((category) => {
              const id = `cookie-${category.key}`
              const checked = category.key === "necessary" ? true : draft[category.key]
              return (
                <li key={category.key} className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-b-0">
                  <label htmlFor={id} className="flex flex-col gap-1 text-[15px] leading-5 font-medium">
                    {category.label}
                    <span className="text-[13px] leading-5 font-normal text-muted-foreground">{category.hint}</span>
                  </label>
                  <Switch
                    id={id}
                    checked={checked}
                    disabled={category.key === "necessary"}
                    onCheckedChange={(value) => {
                      if (category.key !== "necessary") setDraft((d) => ({ ...d, [category.key]: value }))
                    }}
                  />
                </li>
              )
            })}
          </ul>
          <DialogFooter>
            <Button
              className={motion}
              onClick={() => {
                saveConsent(draft)
                setOpen(false)
              }}
            >
              Salvar preferências
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Renders its children only after the visitor allowed the category. Use it around any future analytics or marketing script. */
export function ConsentGate({ category, children, fallback = null }: { category: ConsentCategory; children: React.ReactNode; fallback?: React.ReactNode }) {
  const allowed = useSyncExternalStore(
    subscribeConsent,
    () => hasConsent(category),
    () => false
  )
  return <>{allowed ? children : fallback}</>
}
