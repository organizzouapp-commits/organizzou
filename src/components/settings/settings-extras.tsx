"use client"

import { useState } from "react"
import {
  DownloadIcon,
  FingerprintIcon,
  InfoIcon,
  LandmarkIcon,
  MessageCircleIcon,
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
  { key: "tasks", label: "Tarefas com data", hint: "No dia e 1 hora antes", app: true, wa: true },
  { key: "agenda", label: "Compromissos da agenda", hint: "Conforme o lembrete de cada evento", app: true, wa: true },
  { key: "habits", label: "Hábitos do dia", hint: "Resumo no fim da tarde", app: true, wa: false },
  { key: "bills", label: "Contas a vencer", hint: "3 dias antes e no vencimento", app: true, wa: true },
  { key: "workout", label: "Horário do treino", hint: "30 minutos antes", app: true, wa: false },
  { key: "meals", label: "Refeições e água", hint: "Nos horários que você definir", app: false, wa: false },
  { key: "study", label: "Sessões de estudo e revisões", hint: "Flashcards para revisar", app: true, wa: false },
  { key: "summary", label: "Resumo matinal e revisão semanal", hint: "Todo dia às 7h30 e domingo às 19h", app: true, wa: true },
] as const

export function NotificationsSettings() {
  const [prefs, setPrefs] = useState<Record<string, { app: boolean; wa: boolean }>>(
    Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t.key, { app: t.app, wa: t.wa }]))
  )
  const [quietHours, setQuietHours] = useState(true)
  const [from, setFrom] = useState("22:00")
  const [to, setTo] = useState("07:00")

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section className="flex flex-col">
        <div className="flex items-end justify-between gap-3 border-b border-border pb-2">
          <span className="flex items-center gap-3">
            <SectionTitle>O que avisar</SectionTitle>
            <SoonBadge />
          </span>
          <div className="tabular flex gap-6 pr-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <span>App</span>
            <span>WhatsApp</span>
          </div>
        </div>
        {NOTIFICATION_TYPES.map((type) => (
          <div key={type.key} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] leading-6">{type.label}</span>
              <span className="text-[13px] leading-5 text-muted-foreground">{type.hint}</span>
            </div>
            <div className="flex w-36 items-center justify-between pr-2">
              <Switch
                aria-label={`${type.label} no app`}
                checked={prefs[type.key].app}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, [type.key]: { ...p[type.key], app: v } }))}
              />
              <Switch
                aria-label={`${type.label} no WhatsApp`}
                checked={prefs[type.key].wa}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, [type.key]: { ...p[type.key], wa: v } }))}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="flex max-w-md flex-col gap-4">
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

export function WhatsAppSettings() {
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <section className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <MessageCircleIcon aria-hidden strokeWidth={1.75} className="size-6" />
          <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">WhatsApp</h2>
          <SoonBadge />
        </div>
        <p className="text-[15px] leading-6 text-muted-foreground">
          Em breve você poderá falar com o assistente por texto ou áudio e receber lembretes na hora certa. Só o número verificado aqui conseguirá conversar com a sua conta.
        </p>
        <p className="flex items-start gap-2 rounded-2xl border border-border p-4 text-[15px] leading-6">
          <InfoIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          <span>A conexão ainda não está disponível, então nenhum código é enviado. Avisamos você quando abrir.</span>
        </p>
        <div className="flex flex-col gap-2" aria-disabled>
          <Label htmlFor="phone" className="text-muted-foreground">Número com DDD</Label>
          <div className="flex gap-2">
            <span className="flex h-11 items-center rounded-lg border border-input px-3 text-[15px] text-muted-foreground md:h-9">+55</span>
            <Input id="phone" disabled placeholder="(11) 91234-5678" />
          </div>
        </div>
        <Button disabled className="self-start">
          Enviar código
        </Button>
        <p className="text-[13px] leading-5 text-muted-foreground">O cofre de senhas nunca será acessível pelo WhatsApp.</p>
      </section>
    </div>
  )
}

export function SecuritySettings() {

  return (
    <div className="flex max-w-xl flex-col">
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
        <SectionTitle>Open Finance</SectionTitle>
        <div className="flex items-center gap-3 text-[15px] leading-6">
          <LandmarkIcon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
          <span className="flex flex-1 flex-col">
            Nenhum banco conectado
            <span className="text-[13px] leading-5 text-muted-foreground">A importação automática de lançamentos ainda não está disponível.</span>
          </span>
          <SoonBadge />
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
