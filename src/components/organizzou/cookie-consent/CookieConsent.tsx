"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { ArrowRightIcon } from "lucide-react"

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
 * The preferences dialog (per-category switches) opens only through openCookiePreferences().
 * Mount it once in the root layout. Self-contained: only the shadcn Button, Dialog and Switch are used.
 */
export function CookieConsent({ privacyHref = "/privacidade" }: CookieConsentProps) {
  const stored = useStoredConsent()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
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

  // The bar stays mounted for the exit animation after a choice.
  const showBar = stored === null || closing

  function choose(action: () => void) {
    action()
    setClosing(true)
    window.setTimeout(() => setClosing(false), 400)
  }

  return (
    <>
      {showBar ? (
        <div
          role="region"
          aria-label="Aviso de cookies"
          className={cn(
            "fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-full sm:max-w-[440px]",
            "fill-mode-forwards duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:animate-none",
            closing ? "animate-out fade-out slide-out-to-bottom-4" : "animate-in fade-in slide-in-from-bottom-4"
          )}
        >
          <div className="flex flex-col gap-3 rounded-[20px] border border-border bg-popover p-7 text-left text-popover-foreground">
            <h2 className="text-[20px] leading-7 font-semibold">Antes de continuar…</h2>
            <p className="text-[15px] leading-6 text-muted-foreground">
              Usamos cookies para o Organizzou funcionar bem e melhorar sua experiência. Saiba mais na nossa
              <a
                href={privacyHref}
                className={cn("block w-fit rounded-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/50", motion)}
              >
                Política de privacidade.
              </a>
            </p>
            <div className="mt-3 flex flex-col-reverse gap-3 sm:grid sm:grid-cols-2">
              <Button variant="outline" size="xl" className={motion} onClick={() => choose(rejectOptional)}>
                Não, obrigado
              </Button>
              <Button size="xl" className={motion} onClick={() => choose(acceptAll)}>
                Aceitar cookies <ArrowRightIcon strokeWidth={1.75} />
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
