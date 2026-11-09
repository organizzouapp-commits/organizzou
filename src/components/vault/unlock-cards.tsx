"use client"

import { useEffect, useState } from "react"
import { AlertTriangleIcon, CircleAlertIcon, LockKeyholeIcon, ShieldCheckIcon } from "lucide-react"

import { MIN_MASTER_LENGTH, PasswordField, StrengthMeter } from "@/components/vault/vault-kit"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { passwordStrength } from "@/features/vault/passwords"

const LIMA = "h-12 w-full rounded-full bg-highlight text-[15px] text-highlight-foreground hover:bg-highlight/90"

function CenterCard({ icon: Icon, title, description, children }: { icon: typeof LockKeyholeIcon; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-center py-6 md:py-12">
      <section aria-label={title} data-testid="vault-card" className="flex w-full max-w-md flex-col gap-5 rounded-[20px] border border-border bg-card p-6 md:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span aria-hidden className="flex size-14 items-center justify-center rounded-full border border-border">
            <Icon strokeWidth={1.75} className="size-6" />
          </span>
          <h2 className="text-[20px] leading-7 font-semibold">{title}</h2>
          <p className="text-[14px] leading-5 text-muted-foreground">{description}</p>
        </div>
        {children}
      </section>
    </div>
  )
}

/** The locked state: one card with the master password and "Desbloquear". A wrong password says only that it is wrong. */
export function UnlockCard({ onUnlock }: { onUnlock: (password: string) => Promise<boolean> }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failures, setFailures] = useState(0)
  const [waitUntil, setWaitUntil] = useState(0)
  const [now, setNow] = useState(0)

  // After a few wrong tries the button waits a little longer each time.
  useEffect(() => {
    if (waitUntil <= Date.now()) return
    const id = window.setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= waitUntil) window.clearInterval(id)
    }, 250)
    return () => window.clearInterval(id)
  }, [waitUntil])
  const waiting = waitUntil > now

  return (
    <CenterCard icon={LockKeyholeIcon} title="Cofre bloqueado" description="Digite a senha mestra para desbloquear. Ela nunca sai do seu aparelho.">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!password || busy || waiting) return
          setBusy(true)
          setError(false)
          const ok = await onUnlock(password)
          setBusy(false)
          if (ok) {
            setPassword("")
            return
          }
          setError(true)
          const next = failures + 1
          setFailures(next)
          if (next >= 3) {
            const wait = Math.min(30_000, 1000 * 2 ** (next - 3))
            setWaitUntil(Date.now() + wait)
            setNow(Date.now())
          }
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="master-unlock">Senha mestra</Label>
          <PasswordField id="master-unlock" label="a senha mestra" value={password} onChange={(v) => (setPassword(v), setError(false))} invalid={error} autoFocus describedBy={error ? "master-error" : undefined} />
          {error ? (
            <p id="master-error" role="alert" data-testid="unlock-error" className="flex items-center gap-2 text-[13px] leading-5 font-medium">
              <CircleAlertIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" /> Senha mestra incorreta. Tente de novo.
            </p>
          ) : null}
        </div>
        <Button type="submit" data-testid="unlock-button" disabled={!password || busy || waiting} className={LIMA}>
          {busy ? "Desbloqueando…" : waiting ? "Aguarde um instante…" : "Desbloquear"}
        </Button>
      </form>
    </CenterCard>
  )
}

/** First use: choosing the master password, with its strength and the plain warning that nobody can recover it. */
export function SetupCard({ onCreate }: { onCreate: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [understood, setUnderstood] = useState(false)
  const [busy, setBusy] = useState(false)
  const strength = passwordStrength(password)
  const mismatch = confirm !== "" && confirm !== password
  const valid = password.length >= MIN_MASTER_LENGTH && strength !== "weak" && confirm === password && understood

  return (
    <CenterCard icon={ShieldCheckIcon} title="Crie a senha mestra" description="Ela protege tudo o que você guardar no Cofre. Os dados são criptografados aqui, no seu aparelho.">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!valid || busy) return
          setBusy(true)
          await onCreate(password)
          setBusy(false)
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="master-new">Senha mestra</Label>
          <PasswordField id="master-new" label="a senha mestra" value={password} onChange={setPassword} autoComplete="new-password" autoFocus describedBy="master-hint" />
          <StrengthMeter password={password} />
          <p id="master-hint" className="text-[13px] leading-5 text-muted-foreground">
            Use pelo menos {MIN_MASTER_LENGTH} caracteres, misturando letras, números e símbolos. Uma frase longa funciona bem.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="master-confirm">Confirme a senha mestra</Label>
          <PasswordField id="master-confirm" label="a confirmação" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={mismatch} describedBy={mismatch ? "confirm-error" : undefined} />
          {mismatch ? (
            <p id="confirm-error" role="alert" className="flex items-center gap-2 text-[13px] leading-5 font-medium">
              <CircleAlertIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" /> As senhas não são iguais.
            </p>
          ) : null}
        </div>
        <div data-testid="master-warning" className="flex gap-3 rounded-[14px] border border-border p-3 text-[13px] leading-5">
          <AlertTriangleIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="font-semibold">Não há como recuperar a senha mestra.</strong> Se você esquecer, ninguém consegue abrir o Cofre, nem o Organizzou. Anote-a em um lugar seguro.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="master-understood" checked={understood} onCheckedChange={(v) => setUnderstood(v === true)} className="mt-0.5" />
          <Label htmlFor="master-understood" className="min-h-6 text-[14px] leading-5 font-normal">
            Entendi que a senha mestra não pode ser recuperada.
          </Label>
        </div>
        <Button type="submit" data-testid="create-vault" disabled={!valid || busy} className={LIMA}>
          {busy ? "Criando o cofre…" : "Criar o Cofre"}
        </Button>
      </form>
    </CenterCard>
  )
}
