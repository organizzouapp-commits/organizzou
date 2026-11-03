"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LayoutPanelTopIcon, SlidersHorizontalIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/organizzou/EmptyState"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { savePrefs } from "@/features/today/actions"
import { enabledHighlights, PREFS_STORAGE_KEY, parsePrefsJson, prefsEqual, wantedKeys, type TodayPrefs } from "@/features/today/prefs"
import { cn } from "@/lib/utils"

import { CustomizeDialog } from "./customize"
import { HighlightsSection } from "./highlights"
import { ModuleAccordionProvider } from "./module-accordion"
import { PrefsProvider } from "./prefs-context"
import { TodayStateProvider } from "./today-state"

type TodayLayoutProps = {
  /** Server-rendered widgets (each in its own Suspense boundary), keyed "stat:<id>" and "panel:<id>". Only the wanted ones exist. */
  slots: Record<string, React.ReactNode>
  /** Placeholder for a widget the person just turned on, until the server sends the real one. */
  skeletons: Record<string, React.ReactNode>
  serverPrefs: TodayPrefs
  /** Where `serverPrefs` came from: the database wins over this device's localStorage; the cookie and the defaults do not. */
  source: "db" | "cookie" | "default"
}

const SAVE_DELAY_MS = 500

function readLocal() {
  try {
    return parsePrefsJson(window.localStorage.getItem(PREFS_STORAGE_KEY))
  } catch {
    return null
  }
}
function writeLocal(prefs: TodayPrefs) {
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode / blocked storage: the cookie and the database still keep the layout.
  }
}

/**
 * Owns the layout preferences of "Hoje". Hiding and reordering happen instantly on the widgets already streamed from the server;
 * turning on a widget that was not sent yet shows its skeleton and asks the server for it (`router.refresh`). A change is applied
 * optimistically, saved after a short pause, and rolled back with an honest error if the save fails.
 */
export function TodayLayout({ slots, skeletons, serverPrefs, source }: TodayLayoutProps) {
  const router = useRouter()
  const [prefs, setPrefs] = useState(serverPrefs)
  const [open, setOpen] = useState(false)
  const current = useRef(serverPrefs)
  const confirmed = useRef(serverPrefs)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // This device's localStorage wins over the cookie/defaults (not over the database). Mirror it to the cookie so the server can render it next time.
  useEffect(() => {
    const local = readLocal()
    if (source === "db" || !local) {
      writeLocal(serverPrefs)
      return
    }
    if (!prefsEqual(local, serverPrefs)) {
      // localStorage only exists in the browser, so this one-time reconcile cannot happen during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrefs(local)
      current.current = local
      confirmed.current = local
      void savePrefs(local).then(() => router.refresh())
    }
    // Runs once per page load on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const change = useCallback(
    (next: TodayPrefs, silent = false) => {
      current.current = next
      setPrefs(next)
      writeLocal(next)
      clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        const result = await savePrefs(next).catch(() => ({ ok: false as const, error: "" }))
        if (!result.ok) {
          current.current = confirmed.current
          setPrefs(confirmed.current)
          writeLocal(confirmed.current)
          toast.error("Não foi possível salvar a personalização. Voltamos ao que estava salvo.")
          return
        }
        confirmed.current = next
        if (!silent) toast("Salvo", { duration: 1500 })
        // A widget that was not part of the server render needs its data: ask for it.
        if (wantedKeys(next).some((key) => !(key in slots))) router.refresh()
      }, SAVE_DELAY_MS)
    },
    [router, slots]
  )

  const update = useCallback((fn: (p: TodayPrefs) => TodayPrefs, options?: { silent?: boolean }) => change(fn(current.current), options?.silent), [change])
  const api = useMemo(() => ({ prefs, update }), [prefs, update])

  const node = (key: string) => slots[key] ?? skeletons[key] ?? null
  const items = enabledHighlights(prefs).map((id) => ({ id, node: node(`stat:${id}`) }))

  const visible = prefs.panels.filter((p) => p.visible)
  const main = visible.find((p) => p.id === "seu-dia")
  const hasMain = Boolean(main)
  const aside = visible.filter((p) => p.id !== "seu-dia")

  const customize = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" className="h-11 rounded-full px-3 md:px-5" aria-label="Personalizar" onClick={() => setOpen(true)}>
          <SlidersHorizontalIcon strokeWidth={1.75} />
          <span className="max-md:hidden">Personalizar</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="md:hidden">Personalizar</TooltipContent>
    </Tooltip>
  )

  return (
    <PrefsProvider value={api}>
      <TodayStateProvider>
        <ModuleAccordionProvider>
        {/* From 768 px the page sits in a frame with 24 px rounded corners. The top padding keeps the first row (label, arrows, button)
            clear of that corner zone, so nothing is ever clipped by the curve. */}
        <div className="@container flex min-w-0 flex-col gap-5 pb-6 md:pt-4">
          <HighlightsSection items={items} customize={customize} />

          {visible.length === 0 ? (
            <div className="rounded-[24px] border border-border bg-card">
              <EmptyState
                icon={LayoutPanelTopIcon}
                title="Nenhum painel por aqui"
                description="Você escondeu todos os painéis. Mostre os que quiser em Personalizar."
                action={
                  <Button type="button" className="h-11 rounded-full px-5" onClick={() => setOpen(true)}>
                    <SlidersHorizontalIcon strokeWidth={1.75} /> Personalizar
                  </Button>
                }
              />
            </div>
          ) : (
            <div className={cn("grid min-w-0 grid-cols-1 items-start gap-3 @min-[880px]:gap-x-5", hasMain && "@min-[880px]:grid-cols-[minmax(0,1fr)_minmax(340px,380px)]")}>
              {main ? (
                <div data-panel="seu-dia" className="min-w-0">
                  {node("panel:seu-dia")}
                </div>
              ) : null}
              {/* The module cards: separate cards, 8 px apart, grouped by CSS under "PRECISA DE VOCÊ" (the cards that need attention today)
                  and "NO RITMO" (everything up to date). Each card carries data-needs; `has-[]` orders the wrappers and shows the labels,
                  so the order is decided by the data on every load, with no client JS. */}
              {aside.length > 0 ? (
                <div data-testid="module-cards" className="group/aside flex min-w-0 flex-col gap-2">
                  <p className="order-1 hidden px-1 pb-0.5 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase group-has-[[data-needs=true]]/aside:block">Precisa de você</p>
                  <p className="order-3 mt-2 hidden px-1 pb-0.5 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase group-has-[[data-needs=false]]/aside:block">No ritmo</p>
                  {aside.map((panel) => (
                    <div key={panel.id} data-panel={panel.id} className="order-4 min-w-0 has-[[data-needs=true]]:order-2">
                      {node(`panel:${panel.id}`)}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <CustomizeDialog open={open} onOpenChange={setOpen} prefs={prefs} onChange={change} />
        </ModuleAccordionProvider>
      </TodayStateProvider>
    </PrefsProvider>
  )
}
