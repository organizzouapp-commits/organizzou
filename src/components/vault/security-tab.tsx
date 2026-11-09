"use client"

import { useRef, useState } from "react"
import { AlertTriangleIcon, CircleAlertIcon, DownloadIcon, LockIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { MIN_MASTER_LENGTH, PasswordField, StrengthMeter, chip, SMALL_CAPS, useVaultRepo } from "@/components/vault/vault-kit"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fieldClass, StickyFooter } from "@/components/workouts/sheet-fields"
import { WrongPasswordError } from "@/features/vault/crypto"
import { findReused, passwordStrength } from "@/features/vault/passwords"
import { AUTO_LOCK_OPTIONS, lockVault, replaceKey, setAutoLock, unlockSession, type AutoLock } from "@/features/vault/session"
import type { VaultItem } from "@/features/vault/types"
import { BackupError, changePassword, exportBackup, importBackup, loadItems, parseBackup, unlock, type VaultBackup } from "@/features/vault/vault"
import { cn } from "@/lib/utils"

const CARD = "flex min-w-0 flex-col gap-4 rounded-[20px] border border-border bg-card p-4 md:p-6"

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// ------------------------------------------------------------------ report (computed here, on the device)

function Report({ items }: { items: VaultItem[] }) {
  const logins = items.filter((i) => i.type === "login" && i.password)
  const weak = logins.filter((i) => passwordStrength(i.password as string) === "weak")
  const reusedGroups = findReused(logins.map((i) => ({ id: i.id, password: i.password })))
  const reusedIds = new Set(reusedGroups.flat())
  const byId = new Map(items.map((i) => [i.id, i]))
  const attention = logins.filter((i) => weak.includes(i) || reusedIds.has(i.id))
  return (
    <section aria-label="Relatório de senhas" data-testid="vault-report" className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[17px] leading-6 font-semibold">Relatório de senhas</h3>
        <span data-chip className={chip}>
          calculado neste aparelho
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Senhas", value: logins.length },
          { label: "Fracas", value: weak.length },
          { label: "Repetidas", value: reusedIds.size },
        ].map((stat) => (
          <div key={stat.label} data-stat={stat.label} className="flex flex-col gap-0.5 rounded-[14px] border border-border p-3">
            <span className={SMALL_CAPS}>{stat.label}</span>
            <span className="tabular text-[24px] leading-8 font-semibold">{stat.value}</span>
          </div>
        ))}
      </div>
      {attention.length === 0 ? (
        <p className="text-[13px] leading-5 text-muted-foreground">{logins.length === 0 ? "Quando você guardar senhas, mostramos aqui as que são fracas ou repetidas." : "Nenhuma senha fraca ou repetida. Tudo certo por aqui."}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {attention.map((item) => (
            <li key={item.id} data-attention={item.id} className="flex min-h-12 items-center gap-2 rounded-[14px] border border-border px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{byId.get(item.id)?.name}</span>
              {weak.includes(item) ? <span data-chip className={chip}>Fraca</span> : null}
              {reusedIds.has(item.id) ? <span data-chip className={chip}>Repetida</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ change the master password

function ChangePassword() {
  const { repo } = useVaultRepo()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mismatch = confirm !== "" && confirm !== next
  const valid = current !== "" && next.length >= MIN_MASTER_LENGTH && passwordStrength(next) !== "weak" && next === confirm && next !== current

  async function submit() {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      // The current password is proved again; then everything is re-encrypted in memory and swapped in one atomic write.
      const key = await unlock(repo, current)
      const fresh = await changePassword(repo, key, next)
      replaceKey(fresh)
      setCurrent("")
      setNext("")
      setConfirm("")
      toast.success("Senha mestra alterada. O Cofre foi criptografado de novo.")
    } catch (e) {
      setError(e instanceof WrongPasswordError ? "A senha mestra atual está incorreta." : "Não foi possível alterar a senha. O Cofre continua como estava, com a senha atual.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Alterar a senha mestra" data-testid="change-password" className={CARD}>
      <h3 className="text-[17px] leading-6 font-semibold">Alterar a senha mestra</h3>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="pw-current">Senha mestra atual</Label>
          <PasswordField id="pw-current" label="a senha atual" value={current} onChange={setCurrent} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pw-new">Nova senha mestra</Label>
          <PasswordField id="pw-new" label="a nova senha" value={next} onChange={setNext} autoComplete="new-password" />
          <StrengthMeter password={next} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pw-confirm">Confirme a nova senha</Label>
          <PasswordField id="pw-confirm" label="a confirmação" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={mismatch} />
          {mismatch ? <p className="text-[13px] leading-5 font-medium">As senhas não são iguais.</p> : null}
        </div>
        {error ? (
          <p role="alert" data-testid="change-error" className="flex items-start gap-2 text-[13px] leading-5 font-medium">
            <CircleAlertIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        ) : null}
        <p className="flex items-start gap-2 text-[13px] leading-5 text-muted-foreground">
          <AlertTriangleIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" /> A nova senha também não pode ser recuperada.
        </p>
        <Button type="submit" data-testid="change-button" disabled={!valid || busy} className="h-12 rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/90">
          {busy ? "Criptografando de novo…" : "Alterar a senha mestra"}
        </Button>
      </form>
    </section>
  )
}

// ------------------------------------------------------------------ backup

function Backup({ scope }: { scope: string }) {
  const { repo } = useVaultRepo()
  const picker = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<VaultBackup | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function exportNow() {
    try {
      download(await exportBackup(repo), `organizzou-cofre-backup-${new Date().toISOString().slice(0, 10)}.json`)
      toast.success("Backup criptografado baixado. Ele só abre com a sua senha mestra.")
    } catch {
      toast("Não consegui gerar o backup.")
    }
  }

  async function pick(file: File | null) {
    if (!file) return
    setError(null)
    try {
      if (file.size > 40 * 1024 * 1024) throw new BackupError("too-large")
      setPending(parseBackup(await file.text()))
    } catch {
      setError("Esse arquivo não é um backup válido do Cofre. Nada foi alterado.")
    }
  }

  return (
    <section aria-label="Backup" data-testid="vault-backup" className={CARD}>
      <h3 className="text-[17px] leading-6 font-semibold">Backup criptografado</h3>
      <p className="text-[13px] leading-5 text-muted-foreground">O arquivo guarda só o conteúdo já criptografado, nunca texto aberto, e só abre com a senha mestra do momento em que foi feito.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" data-testid="export-backup" onClick={() => void exportNow()} className="h-11 flex-1 rounded-full">
          <DownloadIcon strokeWidth={1.75} /> Exportar backup
        </Button>
        <Button type="button" variant="outline" data-testid="import-backup" onClick={() => picker.current?.click()} className="h-11 flex-1 rounded-full">
          <UploadIcon strokeWidth={1.75} /> Importar backup
        </Button>
        <input ref={picker} type="file" accept="application/json,.json" aria-label="Arquivo de backup" data-testid="backup-file" className="sr-only" onChange={(e) => (void pick(e.target.files?.[0] ?? null), (e.target.value = ""))} />
      </div>
      {error ? (
        <p role="alert" data-testid="backup-error" className="flex items-start gap-2 text-[13px] leading-5 font-medium">
          <CircleAlertIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      ) : null}
      <ImportSheet scope={scope} backup={pending} onClose={() => setPending(null)} onExportCurrent={() => void exportNow()} />
    </section>
  )
}

function ImportSheet({ backup, onClose, onExportCurrent }: { scope: string; backup: VaultBackup | null; onClose: () => void; onExportCurrent: () => void }) {
  return (
    <ResponsiveSheet open={Boolean(backup)} onOpenChange={(o) => !o && onClose()} title="Importar backup" description="O Cofre atual será substituído pelo conteúdo do backup.">
      {backup ? <ImportForm backup={backup} onClose={onClose} onExportCurrent={onExportCurrent} /> : null}
    </ResponsiveSheet>
  )
}

function ImportForm({ backup, onClose, onExportCurrent }: { backup: VaultBackup; onClose: () => void; onExportCurrent: () => void }) {
  const { repo, scope } = useVaultRepo()
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try {
      // The backup is proved with its own password first (every item and file must open); only then is the current vault replaced.
      const key = await importBackup(repo, backup, password)
      const { items } = await loadItems(repo, key)
      unlockSession(scope, key, items)
      toast.success(`Backup importado: ${items.length} ${items.length === 1 ? "item" : "itens"}.`)
      onClose()
    } catch (e) {
      setError(e instanceof WrongPasswordError ? "Senha mestra do backup incorreta. O Cofre atual não foi alterado." : "O backup está danificado. O Cofre atual não foi alterado.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="flex gap-3 rounded-[14px] border border-border p-3 text-[13px] leading-5">
        <AlertTriangleIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
        <p>
          Tudo o que está no Cofre agora será substituído por <strong className="font-semibold">{backup.items.length}</strong> {backup.items.length === 1 ? "item" : "itens"} do backup, e a senha mestra passa a ser a do backup. Se quiser guardar o Cofre atual antes,{" "}
          <button type="button" onClick={onExportCurrent} className="underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            baixe o backup dele
          </button>
          .
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="import-password">Senha mestra do backup</Label>
        <PasswordField id="import-password" label="a senha do backup" value={password} onChange={setPassword} autoFocus />
        {error ? (
          <p role="alert" data-testid="import-error" className="flex items-start gap-2 text-[13px] leading-5 font-medium">
            <CircleAlertIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        ) : null}
      </div>
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" data-testid="confirm-import" disabled={!password || busy} className="bg-highlight text-highlight-foreground hover:bg-highlight/90">
          {busy ? "Verificando…" : "Substituir o Cofre"}
        </Button>
      </StickyFooter>
    </form>
  )
}

// ------------------------------------------------------------------ the tab

export function SecurityTab({ items, autoLock }: { items: VaultItem[]; autoLock: AutoLock }) {
  const { scope } = useVaultRepo()
  return (
    <div data-testid="vault-security" className="grid grid-cols-1 gap-4 md:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-4 md:col-span-6">
        <section aria-label="Bloqueio" className={CARD}>
          <h3 className="text-[17px] leading-6 font-semibold">Bloqueio automático</h3>
          <div className="flex flex-col gap-2">
            <Label htmlFor="auto-lock">Bloquear o Cofre</Label>
            <Select value={autoLock} onValueChange={(v) => setAutoLock(v as AutoLock)}>
              <SelectTrigger id="auto-lock" data-testid="auto-lock" className={cn(fieldClass, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_LOCK_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[13px] leading-5 text-muted-foreground">O Cofre também bloqueia ao sair da conta ou quando a sessão termina, e a área de transferência é limpa.</p>
          </div>
          <Button type="button" variant="outline" data-testid="lock-now" onClick={() => lockVault()} className="h-11 rounded-full">
            <LockIcon strokeWidth={1.75} /> Bloquear agora
          </Button>
        </section>
        <ChangePassword />
      </div>
      <div className="flex min-w-0 flex-col gap-4 md:col-span-6">
        <Report items={items} />
        <Backup scope={scope} />
      </div>
    </div>
  )
}
