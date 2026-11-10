"use client"

import { useEffect, useState } from "react"
import { InfoIcon } from "lucide-react"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { NOTIFICATION_EVENTS, createLocalNotificationPrefsRepo, defaultPrefs, type EventKey, type NotificationPrefs } from "@/features/settings/notification-prefs"
import { cn } from "@/lib/utils"

import { TimePicker } from "./time-picker"

const repo = createLocalNotificationPrefsRepo()
const chip = "tabular inline-flex h-6 shrink-0 items-center rounded-full border border-foreground/25 px-2.5 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"

/**
 * Avisos: what to warn about (App / E-mail) and the quiet hours. A preview: nothing is sent yet, so e-mail is off and locked ("E-mail em breve")
 * and the choices are only remembered on this device (see notification-prefs.ts).
 */
export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs)

  // Read the saved choices after mount (localStorage does not exist on the server, so the first render uses the defaults).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(repo.load())
  }, [])

  function update(next: NotificationPrefs) {
    setPrefs(next)
    repo.save(next)
  }
  const setEvent = (key: EventKey, app: boolean) => update({ ...prefs, events: { ...prefs.events, [key]: { ...prefs.events[key], app } } })
  const quiet = prefs.quiet

  return (
    <Bento className="@container gap-4">
      <BentoCard title="Não perturbe" className="order-1 col-span-12 @min-[900px]:order-2 @min-[900px]:col-span-4" bodyClassName="gap-4">
        <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
          Silenciar avisos à noite
          <Switch size="lg" checked={quiet.enabled} onCheckedChange={(enabled) => update({ ...prefs, quiet: { ...quiet, enabled } })} />
        </label>
        <div className={cn("grid grid-cols-2 gap-3", !quiet.enabled && "opacity-50")}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="quiet-from">De</Label>
            <TimePicker id="quiet-from" label="De" value={quiet.from} disabled={!quiet.enabled} onChange={(from) => update({ ...prefs, quiet: { ...quiet, from } })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="quiet-to">Até</Label>
            <TimePicker id="quiet-to" label="Até" value={quiet.to} disabled={!quiet.enabled} onChange={(to) => update({ ...prefs, quiet: { ...quiet, to } })} />
          </div>
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">Fora desse horário os avisos chegam na hora certa. Dentro dele, ficam guardados para as {quiet.to}.</p>
        <p data-testid="preview-note" className="flex items-start gap-2 rounded-2xl border border-border p-4 text-[14px] leading-5">
          <InfoIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          <span>Prévia: os avisos ainda não são enviados. Suas escolhas ficam guardadas só neste aparelho e passam a valer quando o envio abrir.</span>
        </p>
      </BentoCard>

      <BentoCard title="Avisos" actions={<span className={chip}>E-mail em breve</span>} className="order-2 col-span-12 @min-[900px]:order-1 @min-[900px]:col-span-8">
        <div role="table" aria-label="O que avisar" className="flex flex-col">
          <div role="row" className="hidden grid-cols-[minmax(0,1fr)_88px_88px] items-center border-b border-border pb-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase @min-[900px]:grid">
            <span role="columnheader">Evento</span>
            <span role="columnheader" className="text-center">
              App
            </span>
            <span role="columnheader" className="text-center">
              E-mail
            </span>
          </div>
          {NOTIFICATION_EVENTS.map((event) => (
            <div key={event.key} role="row" data-event={event.key} className="flex min-h-16 flex-col justify-center gap-3 border-b border-border py-3 last:border-b-0 @min-[900px]:grid @min-[900px]:grid-cols-[minmax(0,1fr)_88px_88px] @min-[900px]:items-center @min-[900px]:gap-0">
              <div role="cell" className="flex min-w-0 flex-col">
                <span className="text-[15px] leading-6 font-medium">{event.label}</span>
                <span className="text-[13px] leading-5 text-muted-foreground">{event.hint}</span>
              </div>
              <div className="flex items-center gap-6 @min-[900px]:contents">
              <div role="cell" className="flex items-center gap-3 @min-[900px]:justify-center">
                <span className="text-[13px] text-muted-foreground @min-[900px]:sr-only">App</span>
                <Switch size="lg" aria-label={`${event.label} no app`} checked={prefs.events[event.key].app} onCheckedChange={(v) => setEvent(event.key, v)} />
              </div>
              <div role="cell" className="flex items-center gap-3 @min-[900px]:justify-center">
                <span className="text-[13px] text-muted-foreground @min-[900px]:sr-only">E-mail</span>
                <Switch size="lg" aria-label={`${event.label} por e-mail (em breve)`} checked={false} disabled />
              </div>
              </div>
            </div>
          ))}
        </div>
      </BentoCard>
    </Bento>
  )
}
