"use client"

import { useState } from "react"
import {
  DownloadIcon,
  FingerprintIcon,
  InfoIcon,
  MailIcon,
  SmartphoneIcon,
  MonitorSmartphoneIcon,
  Trash2Icon,
} from "lucide-react"

import { openCookiePreferences } from "@/components/organizzou/cookie-consent"
import { SectionTitle } from "@/components/organizzou/PageHeader"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const NOTIFICATION_TYPES = [
  { key: "tasks", label: "Tarefas com data", hint: "No dia e 1 hora antes", app: true, email: false },
  { key: "agenda", label: "Compromissos da agenda", hint: "Conforme o lembrete de cada evento", app: true, email: false },
  { key: "habits", label: "Hábitos do dia", hint: "Resumo no fim da tarde", app: true, email: false },
  { key: "bills", label: "Contas a vencer", hint: "3 dias antes e no vencimento", app: true, email: false },
  { key: "workout", label: "Horário do treino", hint: "30 minutos antes", app: true, email: false },
  { key: "meals", label: "Refeições e água", hint: "Nos horários que você definir", app: false, email: false },
  { key: "study", label: "Sessões de estudo e revisões", hint: "Flashcards para revisar", app: true, email: false },
  { key: "summary", label: "Resumo matinal e revisão semanal", hint: "Todo dia às 7h30 e domingo às 19h", app: true, email: false },
] as const

export function NotificationsSettings() {
  const [prefs, setPrefs] = useState<Record<string, { app: boolean; email: boolean }>>(
    Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t.key, { app: t.app, email: t.email }]))
  )
  const [quietHours, setQuietHours] = useState(true)
  const [from, setFrom] = useState("22:00")
  const [to, setTo] = useState("07:00")

  return (
    <div className="@container grid w-full gap-10 @min-[900px]:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] @min-[900px]:items-start">
      <section className="flex flex-col">
        <div className="flex items-end justify-between gap-3 border-b border-border pb-2">
          <span className="flex items-center gap-3">
            <SectionTitle>O que avisar</SectionTitle>
            <SoonBadge />
          </span>
          <div className="grid w-44 shrink-0 grid-cols-2 place-items-center text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <span className="inline-flex items-center gap-1">
              <SmartphoneIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> App
            </span>
            <span className="inline-flex items-center gap-1">
              <MailIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> E-mail
            </span>
          </div>
        </div>
        {NOTIFICATION_TYPES.map((type) => (
          <div key={type.key} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] leading-6">{type.label}</span>
              <span className="text-[13px] leading-5 text-muted-foreground">{type.hint}</span>
            </div>
            <div className="grid w-44 shrink-0 grid-cols-2 place-items-center">
              <Switch
                aria-label={`${type.label} no app`}
                checked={prefs[type.key].app}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, [type.key]: { ...p[type.key], app: v } }))}
              />
              <Switch
                aria-label={`${type.label} por e-mail`}
                checked={prefs[type.key].email}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, [type.key]: { ...p[type.key], email: v } }))}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border p-5">
        <SectionTitle>Não perturbe</SectionTitle>
        <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
          Silenciar avisos à noite
          <Switch checked={quietHours} onCheckedChange={setQuietHours} />
        </label>
        <div className={cn("grid grid-cols-2 gap-4", !quietHours && "opacity-50")}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="quiet-from">De</Label>
            <Input id="quiet-from" type="time" value={from} disabled={!quietHours} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="quiet-to">Até</Label>
            <Input id="quiet-to" type="time" value={to} disabled={!quietHours} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">
          Fora desse horário os avisos chegam na hora certa. Dentro dele, ficam guardados para as {to}.
        </p>
        <p className="flex items-start gap-2 rounded-2xl border border-border p-4 text-[15px] leading-6">
          <InfoIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          <span>Prévia: os avisos ainda não são enviados e estas preferências não são salvas. Elas voltam ao padrão quando você recarrega a página.</span>
        </p>
      </section>
    </div>
  )
}

export function SecuritySettings() {

  return (
    <div className="@container grid w-full gap-x-10 gap-y-2 @min-[860px]:grid-cols-2">
      <section className="flex flex-col gap-4 border-b border-border pb-8">
        <SectionTitle>Segurança da conta</SectionTitle>
        <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
          <span className="flex flex-col">
            <span className="flex items-center gap-2">
              Verificação em duas etapas <SoonBadge />
            </span>
            <span className="text-[13px] leading-5 text-muted-foreground">Em breve: pedir um código do app autenticador ao entrar.</span>
          </span>
          <Switch checked={false} disabled aria-label="Verificação em duas etapas (em breve)" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled>
            <FingerprintIcon strokeWidth={1.75} /> Adicionar passkey (biometria)
          </Button>
          <SoonBadge />
        </div>
        <div className="flex items-center gap-3 text-[15px] leading-6">
          <MonitorSmartphoneIcon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
          <span className="flex flex-col">
            Este navegador
            <span className="text-[13px] leading-5 text-muted-foreground">Sessão atual</span>
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-4 border-b border-border py-8">
        <SectionTitle>Privacidade</SectionTitle>
        <div className="flex items-center gap-3 text-[15px] leading-6">
          <span className="flex flex-1 flex-col">
            Preferências de cookies
            <span className="text-[13px] leading-5 text-muted-foreground">Escolha se podemos usar cookies de análise e de marketing.</span>
          </span>
          <Button variant="outline" onClick={openCookiePreferences}>
            Personalizar
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4 py-8">
        <SectionTitle>Seus dados</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled>
            <DownloadIcon strokeWidth={1.75} /> Exportar tudo (JSON)
          </Button>
          <Button variant="outline" disabled>
            <DownloadIcon strokeWidth={1.75} /> Exportar planilhas (CSV)
          </Button>
          <SoonBadge />
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">A exportação ainda não está disponível. Quando abrir, o cofre só será exportado criptografado, na própria tela do Cofre.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled>
            <Trash2Icon strokeWidth={1.75} /> Excluir minha conta
          </Button>
          <SoonBadge />
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">A exclusão da conta ainda não está disponível por aqui.</p>
      </section>

    </div>
  )
}
