"use client"

import { useRef, useState } from "react"
import { CircleAlertIcon, DicesIcon, FileIcon, PaperclipIcon } from "lucide-react"
import { toast } from "sonner"

import { PasswordField, StrengthMeter } from "@/components/vault/vault-kit"
import { useVaultActions } from "@/components/vault/use-vault-actions"
import { ITEM_ICONS } from "@/components/vault/item-icons"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { fieldClass, pillBase, pillOff, pillOn, StickyFooter } from "@/components/workouts/sheet-fields"
import { generatePassword } from "@/features/vault/passwords"
import { MAX_FILE_BYTES, VAULT_TYPES, VAULT_TYPE_LABELS, type VaultItem, type VaultItemType } from "@/features/vault/types"
import { FileTooLargeError } from "@/features/vault/vault"
import { newId } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

const TEXT = "min-h-24 rounded-[12px] px-3 py-2.5 text-[15px] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`

/** "Adicionar item" / "Editar item": a dialog on desktop and a bottom sheet on phones. Everything typed here is encrypted before it is stored. */
export function ItemSheet({ open, item, defaultType, prefillPassword, onClose, onSaved }: { open: boolean; item: VaultItem | null; defaultType: VaultItemType; prefillPassword?: string; onClose: () => void; onSaved: (item: VaultItem) => void }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={(o) => !o && onClose()} title={item ? "Editar item" : "Adicionar item"} description="Tudo é criptografado no seu aparelho antes de ser guardado.">
      {open ? <ItemForm key={item?.id ?? "new"} item={item} defaultType={defaultType} prefillPassword={prefillPassword} onClose={onClose} onSaved={onSaved} /> : null}
    </ResponsiveSheet>
  )
}

function Field({ id, label, value, onChange, placeholder, inputMode, maxLength }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: "text" | "numeric" | "url"; maxLength?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength ?? 200} autoComplete="off" autoCapitalize="off" spellCheck={false} className={fieldClass} />
    </div>
  )
}

function ItemForm({ item, defaultType, prefillPassword, onClose, onSaved }: { item: VaultItem | null; defaultType: VaultItemType; prefillPassword?: string; onClose: () => void; onSaved: (item: VaultItem) => void }) {
  const actions = useVaultActions()
  const [type, setType] = useState<VaultItemType>(item?.type ?? defaultType)
  const [v, setV] = useState({
    name: item?.name ?? "",
    username: item?.username ?? "",
    password: item?.password ?? prefillPassword ?? "",
    url: item?.url ?? "",
    holder: item?.holder ?? "",
    number: item?.number ?? "",
    expiry: item?.expiry ?? "",
    cvv: item?.cvv ?? "",
    text: item?.text ?? "",
    notes: item?.notes ?? "",
  })
  const set = (key: keyof typeof v) => (value: string) => setV((s) => ({ ...s, [key]: value }))
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const existingFile = item?.file
  const valid = v.name.trim() !== "" && (type !== "document" || file !== null || Boolean(existingFile))

  async function submit() {
    if (!valid || busy) return
    setBusy(true)
    try {
      const stamp = new Date().toISOString()
      const base: VaultItem = { id: item?.id ?? newId(), type, name: v.name.trim(), notes: v.notes.trim() || undefined, updated_at: stamp, created_at: item?.created_at ?? (item ? undefined : stamp), copied_at: item?.copied_at }
      let next: VaultItem = base
      if (type === "login") next = { ...base, username: v.username.trim() || undefined, password: v.password || undefined, url: v.url.trim() || undefined }
      if (type === "card") next = { ...base, holder: v.holder.trim() || undefined, number: v.number.replace(/\s+/g, "") || undefined, expiry: v.expiry.trim() || undefined, cvv: v.cvv.trim() || undefined }
      if (type === "secure_note") next = { ...base, text: v.text || undefined }
      let bytes: Uint8Array | null = null
      if (type === "document") {
        if (file) {
          bytes = new Uint8Array(await file.arrayBuffer())
          next = { ...base, file: { name: file.name, mime: file.type, size: file.size } }
        } else next = { ...base, file: existingFile }
      }
      await actions.save(next, bytes)
      toast.success(item ? "Item atualizado." : "Item guardado no Cofre.")
      onSaved(next)
      onClose()
    } catch (error) {
      if (error instanceof FileTooLargeError) setFileError(`Esse arquivo é maior que o limite de ${mb(MAX_FILE_BYTES)}. Escolha um menor.`)
      else toast("Não consegui guardar o item. Nada foi alterado.")
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
      {item ? null : (
        <div className="flex flex-col gap-2">
          <Label>Tipo</Label>
          <div role="group" aria-label="Tipo do item" className="flex flex-wrap gap-2">
            {VAULT_TYPES.map((t) => {
              const Icon = ITEM_ICONS[t]
              return (
                <button key={t} type="button" aria-pressed={type === t} data-type={t} onClick={() => setType(t)} className={cn(pillBase, "gap-1.5", type === t ? pillOn : pillOff)}>
                  <Icon aria-hidden strokeWidth={1.75} className="size-4" /> {VAULT_TYPE_LABELS[t]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Field id="item-name" label="Nome" value={v.name} onChange={set("name")} placeholder={type === "login" ? "Ex.: Banco" : type === "card" ? "Ex.: Cartão principal" : type === "document" ? "Ex.: RG" : "Ex.: Códigos de recuperação"} />

      {type === "login" ? (
        <>
          <Field id="item-username" label="Usuário ou e-mail" value={v.username} onChange={set("username")} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-password">Senha</Label>
            <div className="flex items-start gap-2">
              <PasswordField id="item-password" label="a senha" value={v.password} onChange={set("password")} className="min-w-0 flex-1" />
              <Button type="button" variant="outline" aria-label="Gerar uma senha forte" onClick={() => set("password")(generatePassword({ length: 20, upper: true, lower: true, digits: true, symbols: true }))} className="size-11 shrink-0 rounded-full p-0">
                <DicesIcon strokeWidth={1.75} />
              </Button>
            </div>
            <StrengthMeter password={v.password} />
          </div>
          <Field id="item-url" label="Site" value={v.url} onChange={set("url")} placeholder="https://" inputMode="url" />
        </>
      ) : null}

      {type === "card" ? (
        <>
          <Field id="item-holder" label="Nome no cartão" value={v.holder} onChange={set("holder")} />
          <Field id="item-number" label="Número" value={v.number} onChange={set("number")} inputMode="numeric" maxLength={23} />
          <div className="grid grid-cols-2 gap-4">
            <Field id="item-expiry" label="Validade" value={v.expiry} onChange={set("expiry")} placeholder="MM/AA" maxLength={7} />
            <Field id="item-cvv" label="Código de segurança" value={v.cvv} onChange={set("cvv")} inputMode="numeric" maxLength={4} />
          </div>
        </>
      ) : null}

      {type === "secure_note" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="item-text">Nota</Label>
          <Textarea id="item-text" value={v.text} maxLength={20000} onChange={(e) => set("text")(e.target.value)} autoComplete="off" spellCheck={false} className={cn(TEXT, "min-h-40")} />
        </div>
      ) : null}

      {type === "document" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="item-file">Arquivo</Label>
          <input
            ref={picker}
            id="item-file"
            type="file"
            className="sr-only"
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null
              if (chosen && chosen.size > MAX_FILE_BYTES) {
                setFile(null)
                setFileError(`Esse arquivo é maior que o limite de ${mb(MAX_FILE_BYTES)}. Escolha um menor.`)
                e.target.value = ""
                return
              }
              setFileError(null)
              setFile(chosen)
            }}
          />
          <button type="button" data-testid="pick-file" onClick={() => picker.current?.click()} className="flex min-h-14 w-full items-center gap-3 rounded-[12px] border border-dashed border-border px-4 text-left text-[14px] outline-none hover:bg-accent focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary">
            {file || existingFile ? <FileIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" /> : <PaperclipIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />}
            <span className="min-w-0 flex-1 truncate">{file ? `${file.name} · ${mb(file.size)}` : existingFile ? `${existingFile.name} · ${mb(existingFile.size)}` : `Escolher arquivo (até ${mb(MAX_FILE_BYTES)})`}</span>
            {file || existingFile ? <span className="text-[13px] text-muted-foreground">Trocar</span> : null}
          </button>
          {fileError ? (
            <p role="alert" data-testid="file-error" className="flex items-start gap-2 text-[13px] leading-5 font-medium">
              <CircleAlertIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" /> {fileError}
            </p>
          ) : (
            <p className="text-[13px] leading-5 text-muted-foreground">O arquivo é criptografado antes de ser guardado.</p>
          )}
        </div>
      ) : null}

      {type !== "secure_note" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="item-notes">Anotações (opcional)</Label>
          <Textarea id="item-notes" value={v.notes} maxLength={5000} onChange={(e) => set("notes")(e.target.value)} autoComplete="off" spellCheck={false} className={TEXT} />
        </div>
      ) : null}

      <StickyFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid || busy} className="bg-highlight text-highlight-foreground hover:bg-highlight/90">
          {busy ? "Guardando…" : item ? "Salvar" : "Guardar"}
        </Button>
      </StickyFooter>
    </form>
  )
}
