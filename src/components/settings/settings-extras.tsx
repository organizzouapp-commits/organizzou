"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CheckCircle2Icon,
  DownloadIcon,
  FingerprintIcon,
  LandmarkIcon,
  LogOutIcon,
  MessageCircleIcon,
  MonitorSmartphoneIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { openCookiePreferences } from "@/components/organizzou/cookie-consent"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { SectionTitle } from "@/components/organizzou/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ""
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

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
          <SectionTitle>O que avisar</SectionTitle>
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
        <Button className="self-start" onClick={() => toast.success("Preferências de aviso salvas.")}>
          Salvar preferências
        </Button>
      </section>
    </div>
  )
}

export function WhatsAppSettings() {
  const [step, setStep] = useState<"idle" | "code" | "linked">("idle")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [optIn, setOptIn] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const digits = phone.replace(/\D/g, "")

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <section className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <MessageCircleIcon aria-hidden strokeWidth={1.75} className="size-6" />
          <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">WhatsApp</h2>
          {step === "linked" ? <Badge variant="secondary">Conectado</Badge> : null}
        </div>
        <p className="text-[15px] leading-6 text-muted-foreground">
          Fale com o assistente por texto ou áudio e receba lembretes na hora certa. Só o número verificado aqui consegue conversar com a sua conta.
        </p>

        {step === "idle" ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (digits.length < 10 || !optIn) return
              setStep("code")
              toast("Enviamos um código de 6 dígitos para o seu WhatsApp.")
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Número com DDD</Label>
              <div className="flex gap-2">
                <span className="flex h-11 items-center rounded-lg border border-input px-3 text-[15px] md:h-9">+55</span>
                <Input id="phone" inputMode="tel" autoComplete="tel-national" placeholder="(11) 91234-5678" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
              </div>
            </div>
            <label className="flex items-start gap-3 text-[15px] leading-6">
              <Checkbox checked={optIn} onCheckedChange={(v) => setOptIn(v === true)} className="mt-0.5" />
              Aceito receber mensagens do Organizzou por WhatsApp. Posso sair a qualquer momento enviando SAIR.
            </label>
            <Button type="submit" className="self-start" disabled={digits.length < 10 || !optIn}>
              Enviar código
            </Button>
          </form>
        ) : null}

        {step === "code" ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length !== 6) return
              setStep("linked")
              toast.success("WhatsApp conectado.")
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Código de 6 dígitos</Label>
              <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="tabular w-40 text-center text-xl tracking-[0.3em]" />
              <p className="text-[13px] leading-5 text-muted-foreground">Enviado para +55 {phone}. O código vale por 10 minutos.</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={code.length !== 6}>
                Confirmar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("idle")}>
                Trocar número
              </Button>
            </div>
          </form>
        ) : null}

        {step === "linked" ? (
          <div className="flex flex-col gap-5">
            <p className="flex items-center gap-2 text-[15px] leading-6">
              <CheckCircle2Icon aria-hidden strokeWidth={1.75} className="size-5" />
              <span className="tabular">+55 {phone}</span> verificado
            </p>
            <div className="flex flex-col border-t border-border">
              {["Registrar por texto e áudio", "Receber lembretes e resumos", "Confirmar ações sensíveis com botões"].map((item) => (
                <div key={item} className="flex min-h-12 items-center gap-3 border-b border-border text-[15px] leading-6">
                  <CheckCircle2Icon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" />
                  {item}
                </div>
              ))}
            </div>
            <p className="text-[13px] leading-5 text-muted-foreground">O cofre de senhas nunca é acessível pelo WhatsApp.</p>
            <Button variant="outline" className="self-start" onClick={() => setConfirmUnlink(true)}>
              <LogOutIcon strokeWidth={1.75} /> Desconectar WhatsApp
            </Button>
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={confirmUnlink}
        onOpenChange={setConfirmUnlink}
        title="Desconectar o WhatsApp?"
        description="Você deixa de receber lembretes e de falar com o assistente por lá. Dá para conectar de novo quando quiser."
        confirmLabel="Desconectar"
        onConfirm={() => {
          setConfirmUnlink(false)
          setStep("idle")
          setPhone("")
          setCode("")
          setOptIn(false)
          toast("WhatsApp desconectado.")
        }}
      />
    </div>
  )
}

export function SecuritySettings() {
  const [twoFactor, setTwoFactor] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <div className="flex max-w-xl flex-col">
      <section className="flex flex-col gap-4 border-b border-border pb-8">
        <SectionTitle>Segurança da conta</SectionTitle>
        <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
          <span className="flex flex-col">
            Verificação em duas etapas
            <span className="text-[13px] leading-5 text-muted-foreground">Pede um código do app autenticador ao entrar.</span>
          </span>
          <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
        </label>
        <Button variant="outline" className="self-start" onClick={() => toast("Passkeys chegam em breve para o seu aparelho.")}>
          <FingerprintIcon strokeWidth={1.75} /> Adicionar passkey (biometria)
        </Button>
        <div className="flex items-center gap-3 text-[15px] leading-6">
          <MonitorSmartphoneIcon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
          <span className="flex flex-col">
            Este navegador
            <span className="text-[13px] leading-5 text-muted-foreground">São Paulo · ativo agora</span>
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-4 border-b border-border py-8">
        <SectionTitle>Open Finance</SectionTitle>
        <div className="flex items-center gap-3 text-[15px] leading-6">
          <LandmarkIcon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
          <span className="flex-1">Nubank e Itaú conectados</span>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/financas">Gerenciar</Link>
          </Button>
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toast.success("Exportação em JSON pronta.")}>
            <DownloadIcon strokeWidth={1.75} /> Exportar tudo (JSON)
          </Button>
          <Button variant="outline" onClick={() => toast.success("Planilhas CSV prontas.")}>
            <DownloadIcon strokeWidth={1.75} /> Exportar planilhas (CSV)
          </Button>
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">O cofre só é exportado criptografado, na própria tela do Cofre.</p>
        <Button variant="destructive" className="self-start" onClick={() => setDeleting(true)}>
          <Trash2Icon strokeWidth={1.75} /> Excluir minha conta
        </Button>
      </section>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir sua conta?"
        description="Todos os seus dados, inclusive o cofre, serão apagados de forma definitiva. Exporte um backup antes."
        confirmLabel="Excluir conta"
        onConfirm={() => {
          setDeleting(false)
          toast("Enviamos um e-mail para você confirmar a exclusão da conta.")
        }}
      />
    </div>
  )
}
