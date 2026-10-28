"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  CopyIcon,
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FileTextIcon,
  IdCardIcon,
  KeyRoundIcon,
  LockIcon,
  LockOpenIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { Bento, bentoCardClass, BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  entropyBits,
  findReused,
  generatePassword,
  passwordStrength,
  STRENGTH_LABELS,
  type GeneratorOptions,
} from "@/features/vault/passwords"
import { VAULT_TYPE_LABELS, type VaultItemRow, type VaultItemType } from "@/features/vault/types"
import { cn } from "@/lib/utils"
import { buildMockVaultItems, mockVaultFolders } from "@/mocks/vault"
import { mockId } from "@/mocks/time"

const TYPE_ICONS: Record<VaultItemType, LucideIcon> = {
  login: KeyRoundIcon,
  card: CreditCardIcon,
  document: IdCardIcon,
  secure_note: FileTextIcon,
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard can be blocked (insecure context); the toast still confirms the action in the prototype.
  }
  toast.success(`${label} copiado. Será limpo da área de transferência em 30 segundos.`)
}

export function CofreScreen({ nowIso }: { nowIso: string }) {
  const [unlocked, setUnlocked] = useState(false)
  const [master, setMaster] = useState("")
  const [items, setItems] = useState<VaultItemRow[]>(() => buildMockVaultItems(nowIso))
  const [folder, setFolder] = useState("all")
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<VaultItemRow | null>(null)
  const [autoLock, setAutoLock] = useState("5")
  // From 1280 px the item opens in a panel next to the list (like 1Password); below that, as a full-screen sheet.
  const panelMode = useMediaQuery("(min-width: 1280px)")

  usePrimaryAction("Novo item", () => {
    if (!unlocked) {
      toast("Desbloqueie o cofre para guardar um item.")
      return
    }
    setCreating(true)
  })

  if (!unlocked) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader />
        <div className="flex min-h-[55dvh] items-center justify-center">
        <BentoCard className="w-full max-w-md">
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!master.trim()) return
            setUnlocked(true)
            setMaster("")
          }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <LockIcon aria-hidden strokeWidth={1.75} className="size-10 text-muted-foreground" />
            <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">Cofre bloqueado</h2>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="master">Senha mestra</Label>
            <Input id="master" type="password" autoComplete="current-password" autoFocus value={master} onChange={(e) => setMaster(e.target.value)} />
            <p className="text-[13px] leading-5 text-muted-foreground">
              A senha mestra nunca sai do seu aparelho. Nem o Organizzou nem o assistente conseguem ler o cofre.
            </p>
          </div>
          <Button type="submit" size="lg" disabled={!master.trim()}>
            <LockOpenIcon strokeWidth={1.75} /> Desbloquear
          </Button>
        </form>
        </BentoCard>
        </div>
      </div>
    )
  }

  const visible = items
    .filter((i) => (folder === "all" ? true : i.folder_id === folder))
    .filter((i) => (typeFilter === "all" ? true : i.type === typeFilter))
    .filter((i) => !query.trim() || i.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  const open = items.find((i) => i.id === openId) ?? null
  const logins = items.filter((i) => i.type === "login")
  const weak = logins.filter((i) => i.password && passwordStrength(i.password) === "weak")
  const reusedGroups = findReused(logins)
  const reusedIds = new Set(reusedGroups.flat())

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actions={
          <Button variant="outline" onClick={() => { setUnlocked(false); setOpenId(null) }}>
            <LockIcon strokeWidth={1.75} /> Bloquear
          </Button>
        }
      />

      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="gerador">Gerador</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="pt-5">
          <div className="@container">
          <div className="grid items-start gap-5 @min-[880px]:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          <BentoCard bodyClassName="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-48 md:max-w-80">
              <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no cofre" aria-label="Buscar no cofre" className="pl-9" />
            </div>
            <Select value={folder} onValueChange={setFolder}>
              <SelectTrigger aria-label="Pasta" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as pastas</SelectItem>
                {mockVaultFolders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger aria-label="Tipo" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {(Object.keys(VAULT_TYPE_LABELS) as VaultItemType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {VAULT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            {visible.map((item) => {
              const Icon = TYPE_ICONS[item.type]
              const strength = item.password ? passwordStrength(item.password) : null
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOpenId(item.id)}
                  className="flex min-h-14 w-full items-center gap-4 border-b border-border py-3 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Icon aria-hidden strokeWidth={1.75} className="ml-1 size-5 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] leading-6">{item.name}</span>
                    <span className="truncate text-[13px] leading-5 text-muted-foreground">
                      {VAULT_TYPE_LABELS[item.type]}
                      {item.type === "login" ? ` · ${item.fields[0]?.value}` : ""}
                    </span>
                  </span>
                  {strength === "weak" || reusedIds.has(item.id) ? (
                    <span className="inline-flex items-center gap-1 text-[13px] leading-5">
                      <ShieldAlertIcon aria-hidden strokeWidth={1.75} className="size-4" />
                      {strength === "weak" ? "Fraca" : "Repetida"}
                    </span>
                  ) : null}
                </button>
              )
            })}
            {visible.length === 0 ? <p className="py-6 text-[15px] leading-6 text-muted-foreground">Nenhum item encontrado.</p> : null}
          </div>
          </BentoCard>
          <aside className="flex min-w-0 flex-col gap-4 @min-[880px]:sticky @min-[880px]:top-0">
          {panelMode && open ? (
            <section aria-label="Detalhes do item" className={cn(bentoCardClass(), "flex flex-col gap-4")}>
              <ItemBody key={open.id} item={open} onClose={() => setOpenId(null)} onDelete={setToDelete} />
            </section>
          ) : null}
          <BentoCard title="Resumo" bodyClassName="flex flex-col gap-3 text-[15px] leading-6">
            <p className="flex justify-between"><span className="text-muted-foreground">Itens</span><span className="tabular">{items.length}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Senhas fracas</span><span className="tabular">{weak.length}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Repetidas</span><span className="tabular">{reusedIds.size}</span></p>
          </BentoCard>
          </aside>
          </div>
          </div>
        </TabsContent>

        <TabsContent value="gerador" className="pt-5">
          <BentoCard title="Gerador de senhas">
            <Generator />
          </BentoCard>
        </TabsContent>

        <TabsContent value="seguranca" className="pt-5">
          <Bento>
          <KpiCard tone="highlight" label="Itens" value={`${items.length}`} support="no cofre" className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Senhas fracas" value={`${weak.length}`} support="para trocar" className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Repetidas" value={`${reusedIds.size}`} support={`${reusedGroups.length} grupo(s)`} className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Fortes" value={`${logins.length - weak.length}`} support={`de ${logins.length} logins`} className="col-span-6 @min-[1040px]:col-span-3" />

          {weak.length + reusedIds.size === 0 ? (
            <BentoCard className="col-span-12 @min-[900px]:col-span-7">
            <p className="flex items-center gap-2 text-[15px] leading-6">
              <ShieldCheckIcon aria-hidden strokeWidth={1.75} className="size-5" /> Tudo certo: nenhuma senha fraca ou repetida.
            </p>
            </BentoCard>
          ) : (
            <BentoCard title="Para corrigir" className="col-span-12 @min-[900px]:col-span-7">
              {[...new Set([...weak.map((i) => i.id), ...reusedIds])].map((id) => {
                const item = items.find((i) => i.id === id)
                if (!item) return null
                const isWeak = item.password ? passwordStrength(item.password) === "weak" : false
                return (
                  <div key={id} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                    <ShieldAlertIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] leading-6">{item.name}</span>
                      <span className="text-[13px] leading-5 text-muted-foreground">
                        {isWeak ? "Senha fraca" : "Mesma senha usada em outro item"}
                      </span>
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setOpenId(item.id)}>
                      Abrir
                    </Button>
                  </div>
                )
              })}
            </BentoCard>
          )}

          <BentoCard title="Proteção" className="col-span-12 @min-[900px]:col-span-5" bodyClassName="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="autolock">Bloquear automaticamente</Label>
              <Select value={autoLock} onValueChange={setAutoLock}>
                <SelectTrigger id="autolock" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Após 1 minuto sem uso</SelectItem>
                  <SelectItem value="5">Após 5 minutos sem uso</SelectItem>
                  <SelectItem value="15">Após 15 minutos sem uso</SelectItem>
                  <SelectItem value="0">Só quando eu bloquear</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" disabled>
                <DownloadIcon strokeWidth={1.75} /> Exportar backup criptografado
              </Button>
              <SoonBadge />
            </div>
            <p className="text-[13px] leading-5 text-muted-foreground">
              O backup ainda não está disponível. Quando abrir, ele só poderá ser aberto com a sua senha mestra, e o cofre nunca será exportado em texto aberto.
            </p>
          </BentoCard>
          </Bento>
        </TabsContent>
      </Tabs>

      <ItemSheet item={panelMode ? null : open} onClose={() => setOpenId(null)} onDelete={setToDelete} />
      <NewItemDialog
        open={creating}
        onOpenChange={setCreating}
        nowIso={nowIso}
        onCreate={(item) => {
          setItems((current) => [...current, item])
          toast.success("Item guardado no cofre.")
        }}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir este item?"
        description={toDelete ? `“${toDelete.name}” será apagado do cofre. Essa ação não pode ser desfeita.` : ""}
        onConfirm={() => {
          const item = toDelete
          setToDelete(null)
          if (!item) return
          setItems((current) => current.filter((i) => i.id !== item.id))
          setOpenId(null)
          toast("Item excluído.")
        }}
      />
    </div>
  )
}

// ----------------------------------------------------------- generator

function Generator() {
  const [options, setOptions] = useState<GeneratorOptions>({ length: 18, upper: true, lower: true, digits: true, symbols: true })
  const [password, setPassword] = useState(() => generatePassword({ length: 18, upper: true, lower: true, digits: true, symbols: true }))
  const strength = passwordStrength(password)
  const bits = entropyBits(password)

  function update(patch: Partial<GeneratorOptions>) {
    const next = { ...options, ...patch }
    setOptions(next)
    setPassword(generatePassword(next))
  }

  return (
    <div className="@container">
      <div className="grid gap-8 @min-[760px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex items-center gap-2">
            <output aria-label="Senha gerada" className="tabular min-w-0 flex-1 rounded-xl border border-border px-4 py-3 font-mono text-[17px] leading-6 break-all">
              {password || "Escolha ao menos um tipo de caractere"}
            </output>
            <Button variant="outline" size="icon" aria-label="Gerar outra" onClick={() => setPassword(generatePassword(options))}>
              <RefreshCwIcon strokeWidth={1.75} />
            </Button>
            <Button size="icon" aria-label="Copiar senha" disabled={!password} onClick={() => void copy(password, "Senha")}>
              <CopyIcon strokeWidth={1.75} />
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <div className="tabular flex justify-between text-[13px] leading-5">
              <span>Força: {STRENGTH_LABELS[strength]}</span>
              <span className="text-muted-foreground">{bits} bits</span>
            </div>
            <Progress value={Math.min(100, (bits / 100) * 100)} aria-label="Força da senha" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Label htmlFor="gen-length" className="tabular">
              Tamanho: {options.length} caracteres
            </Label>
            <Slider id="gen-length" min={8} max={64} step={1} value={[options.length]} onValueChange={([v]) => update({ length: v })} aria-label="Tamanho da senha" />
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {(
              [
                ["upper", "Maiúsculas (A–Z)"],
                ["lower", "Minúsculas (a–z)"],
                ["digits", "Números (0–9)"],
                ["symbols", "Símbolos (!@#$)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex min-h-11 items-center gap-3 text-[15px] whitespace-nowrap">
                <Checkbox checked={options[key]} onCheckedChange={(v) => update({ [key]: v === true })} />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------- item views

function ItemSheet({ item, onClose, onDelete }: { item: VaultItemRow | null; onClose: () => void; onDelete: (item: VaultItemRow) => void }) {
  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="data-[side=bottom]:h-dvh data-[side=bottom]:max-h-dvh gap-0 overflow-y-auto rounded-none p-4 md:p-6">
        <SheetTitle className="sr-only">{item?.name ?? "Item do cofre"}</SheetTitle>
        <SheetDescription className="sr-only">Detalhes do item do cofre.</SheetDescription>
        {item ? (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
            <ItemBody key={item.id} item={item} onClose={onClose} onDelete={onDelete} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function ItemBody({ item, onClose, onDelete }: { item: VaultItemRow; onClose: () => void; onDelete: (item: VaultItemRow) => void }) {
  const [revealed, setRevealed] = useState<string[]>([])
  const Icon = TYPE_ICONS[item.type]
  const strength = item.password ? passwordStrength(item.password) : null

  return (
    <>
      <header className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-[17px] leading-6 font-semibold">
          <Icon aria-hidden strokeWidth={1.75} className="size-5" /> {item.name}
        </h2>
        <p className="text-[13px] leading-5 text-muted-foreground">
          {VAULT_TYPE_LABELS[item.type]} · atualizado em {format(new Date(item.updated_at), "d 'de' MMM yyyy", { locale: ptBR })}
        </p>
      </header>
      <dl className="flex flex-col">
        {item.fields.map((field) => {
          const secret = item.secrets.includes(field.label)
          const shown = !secret || revealed.includes(field.label)
          return (
            <div key={field.label} className="flex items-center gap-2 border-b border-border py-3 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <dt className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{field.label}</dt>
                <dd className={cn("text-[15px] leading-6 break-words whitespace-pre-wrap", secret && shown && "font-mono")}>
                  {shown ? field.value : "••••••••••••"}
                </dd>
              </div>
              {secret ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={shown ? `Ocultar ${field.label}` : `Mostrar ${field.label}`}
                  onClick={() => setRevealed((r) => (shown ? r.filter((l) => l !== field.label) : [...r, field.label]))}
                >
                  {shown ? <EyeOffIcon strokeWidth={1.75} /> : <EyeIcon strokeWidth={1.75} />}
                </Button>
              ) : null}
              <Button variant="ghost" size="icon-sm" aria-label={`Copiar ${field.label}`} onClick={() => void copy(field.value, field.label)}>
                <CopyIcon strokeWidth={1.75} />
              </Button>
            </div>
          )
        })}
      </dl>
      {strength ? (
        <p className="flex items-center gap-2 text-[13px] leading-5 text-muted-foreground">
          {strength === "weak" ? <ShieldAlertIcon aria-hidden strokeWidth={1.75} className="size-4" /> : <ShieldCheckIcon aria-hidden strokeWidth={1.75} className="size-4" />}
          Senha {STRENGTH_LABELS[strength].toLowerCase()}
          {strength === "weak" ? ". Troque por uma senha mais longa." : "."}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" onClick={() => onDelete(item)}>
          <Trash2Icon strokeWidth={1.75} /> Excluir
        </Button>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </>
  )
}

function NewItemDialog({
  open,
  onOpenChange,
  nowIso,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nowIso: string
  onCreate: (item: VaultItemRow) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <NewItemForm nowIso={nowIso} onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function NewItemForm({ nowIso, onCreate, onClose }: { nowIso: string; onCreate: (item: VaultItemRow) => void; onClose: () => void }) {
  const [type, setType] = useState<VaultItemType>("login")
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [secret, setSecret] = useState("")
  const [url, setUrl] = useState("")
  const [note, setNote] = useState("")
  const [folder, setFolder] = useState(mockVaultFolders[0].id)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        const base = { id: mockId("vault"), folder_id: folder, type, name: name.trim(), updated_at: nowIso }
        if (type === "login") {
          onCreate({ ...base, fields: [{ label: "Usuário", value: username }, { label: "Senha", value: secret }, { label: "Site", value: url }], secrets: ["Senha"], password: secret })
        } else if (type === "secure_note") {
          onCreate({ ...base, fields: [{ label: "Nota", value: note }], secrets: ["Nota"] })
        } else if (type === "card") {
          onCreate({ ...base, fields: [{ label: "Número", value: secret }, { label: "Observação", value: note }], secrets: ["Número"] })
        } else {
          onCreate({ ...base, fields: [{ label: "Número do documento", value: secret }, { label: "Observação", value: note }], secrets: ["Número do documento"] })
        }
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Novo item</DialogTitle>
        <DialogDescription className="sr-only">Guarde um login, cartão, documento ou nota segura.</DialogDescription>
      </DialogHeader>
      <ToggleGroup type="single" variant="outline" value={type} onValueChange={(v) => v && setType(v as VaultItemType)} className="flex-wrap justify-start">
        {(Object.keys(VAULT_TYPE_LABELS) as VaultItemType[]).map((t) => (
          <ToggleGroupItem key={t} value={t}>
            {VAULT_TYPE_LABELS[t]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-col gap-2">
        <Label htmlFor="v-name">Nome</Label>
        <Input id="v-name" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </div>
      {type === "login" ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="v-user">Usuário</Label>
            <Input id="v-user" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="v-pass">Senha</Label>
            <div className="flex gap-2">
              <Input id="v-pass" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} className="font-mono" />
              <Button type="button" variant="outline" size="icon" aria-label="Gerar senha" onClick={() => setSecret(generatePassword({ length: 18, upper: true, lower: true, digits: true, symbols: true }))}>
                <RefreshCwIcon strokeWidth={1.75} />
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="v-url">Site</Label>
            <Input id="v-url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        </>
      ) : type === "secure_note" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="v-note">Nota</Label>
          <Textarea id="v-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="v-secret">{type === "card" ? "Número do cartão" : "Número do documento"}</Label>
            <Input id="v-secret" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="v-obs">Observação</Label>
            <Input id="v-obs" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="v-folder">Pasta</Label>
        <Select value={folder} onValueChange={setFolder}>
          <SelectTrigger id="v-folder" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mockVaultFolders.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          Guardar
        </Button>
      </DialogFooter>
    </form>
  )
}
