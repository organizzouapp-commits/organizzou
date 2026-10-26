"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowLeftIcon,
  BellIcon,
  BoldIcon,
  EllipsisIcon,
  FolderIcon,
  HeadingIcon,
  ItalicIcon,
  ListIcon,
  MessageCircleIcon,
  NotebookPenIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { PageHeader, SectionTitle } from "@/components/organizzou/PageHeader"
import { Badge } from "@/components/ui/badge"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { parseMarkdown, wordCount, type Inline } from "@/features/notes/markdown"
import type { NoteRow, ReminderChannel, ReminderRow } from "@/features/notes/types"
import { dayDiff, formatDue, toDueIso } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { buildMockNotes, buildMockReminders, mockFolders } from "@/mocks/notes"
import { dayOf, MOCK_TIMEZONE, mockId } from "@/mocks/time"

const USER = "00000000-0000-4000-8000-000000000001"

function InlineText({ runs }: { runs: Inline[] }) {
  return (
    <>
      {runs.map((run, index) =>
        run.bold ? (
          <strong key={index} className="font-semibold">
            {run.text}
          </strong>
        ) : run.italic ? (
          <em key={index}>{run.text}</em>
        ) : (
          <span key={index}>{run.text}</span>
        )
      )}
    </>
  )
}

function NotePreview({ source }: { source: string }) {
  const blocks = parseMarkdown(source)
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-6">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return block.level === 1 ? (
            <h2 key={index} className="text-xl leading-7 font-semibold tracking-[-0.01em]">
              <InlineText runs={block.inline} />
            </h2>
          ) : (
            <h3 key={index} className="text-[17px] leading-6 font-semibold">
              <InlineText runs={block.inline} />
            </h3>
          )
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="flex list-disc flex-col gap-1 pl-5">
              {block.items.map((item, i) => (
                <li key={i}>
                  <InlineText runs={item} />
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={index}>
            <InlineText runs={block.inline} />
          </p>
        )
      })}
    </div>
  )
}

export function NotasScreen({ nowIso }: { nowIso: string }) {
  const today = dayOf(nowIso)
  const now = new Date(nowIso)
  const [notes, setNotes] = useState<NoteRow[]>(() => buildMockNotes(nowIso))
  const [reminders, setReminders] = useState<ReminderRow[]>(() => buildMockReminders(nowIso))
  const [folder, setFolder] = useState<string>("all")
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [toDelete, setToDelete] = useState<NoteRow | null>(null)
  const [creatingReminder, setCreatingReminder] = useState(false)

  const visible = notes
    .filter((n) => {
      if (folder === "pinned") return n.pinned
      if (folder !== "all" && n.folder_id !== folder) return false
      const text = `${n.title} ${n.body} ${n.tags.join(" ")}`.toLowerCase()
      return !query.trim() || text.includes(query.trim().toLowerCase())
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at))
  const open = notes.find((n) => n.id === openId) ?? null

  function updateNote(id: string, patch: Partial<NoteRow>) {
    setNotes((current) => current.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n)))
  }

  function createNote() {
    const stamp = new Date().toISOString()
    const created: NoteRow = {
      id: mockId("note"),
      user_id: USER,
      folder_id: folder !== "all" && folder !== "pinned" ? folder : null,
      title: "Nova nota",
      body: "",
      pinned: false,
      tags: [],
      created_at: stamp,
      updated_at: stamp,
    }
    setNotes((current) => [created, ...current])
    setOpenId(created.id)
    setEditing(true)
  }

  function insert(marker: "bold" | "italic" | "list" | "heading") {
    if (!open) return
    const addition = { bold: "**texto**", italic: "*texto*", list: "\n- item", heading: "\n## Título" }[marker]
    updateNote(open.id, { body: open.body + addition })
  }

  const sections = [
    { key: "all", label: "Todas as notas", icon: NotebookPenIcon, count: notes.length },
    { key: "pinned", label: "Fixadas", icon: PinIcon, count: notes.filter((n) => n.pinned).length },
    ...mockFolders.map((f) => ({ key: f.id, label: f.name, icon: FolderIcon, count: notes.filter((n) => n.folder_id === f.id).length })),
  ]

  // ---------------------------------------------------------- reminders
  const pending = reminders.filter((r) => r.status === "pending").sort((a, b) => a.remind_at.localeCompare(b.remind_at))
  const done = reminders.filter((r) => r.status === "done")
  const groupOf = (r: ReminderRow) => {
    const diff = dayDiff(r.remind_at, now, MOCK_TIMEZONE)
    return diff < 0 ? "Atrasados" : diff === 0 ? "Hoje" : diff === 1 ? "Amanhã" : "Mais tarde"
  }
  const groups = ["Atrasados", "Hoje", "Amanhã", "Mais tarde"]
    .map((label) => ({ label, items: pending.filter((r) => groupOf(r) === label) }))
    .filter((g) => g.items.length > 0)

  function snooze(reminder: ReminderRow, hours: number) {
    setReminders((current) =>
      current.map((r) => (r.id === reminder.id ? { ...r, remind_at: new Date(new Date(r.remind_at).getTime() + hours * 3_600_000).toISOString() } : r))
    )
    toast(`Adiado em ${hours === 1 ? "1 hora" : `${hours} horas`}.`)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Notas e lembretes" description="Anote agora, encontre depois e seja lembrado na hora certa." />

      <Tabs defaultValue="notas">
        <TabsList>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="lembretes">Lembretes</TabsTrigger>
        </TabsList>

        <TabsContent value="notas" className="pt-6">
          <div className="grid gap-8 md:grid-cols-[13rem_minmax(0,20rem)_minmax(0,1fr)]">
            {/* folders */}
            <nav aria-label="Pastas" className={cn("flex flex-col gap-1", open && "hidden md:flex")}>
              {sections.map(({ key, label, icon: Icon, count }) => (
                <button
                  key={key}
                  type="button"
                  aria-current={folder === key}
                  onClick={() => setFolder(key)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-full px-3 text-left text-[15px] leading-6 outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9",
                    folder === key && "bg-highlight font-medium text-highlight-foreground hover:bg-highlight"
                  )}
                >
                  <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  <span className="tabular text-[13px] opacity-70">{count}</span>
                </button>
              ))}
            </nav>

            {/* list */}
            <section className={cn("flex min-w-0 flex-col gap-3", open && "hidden md:flex")}>
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar notas" aria-label="Buscar notas" className="pl-9" />
                </div>
                <Button size="icon" aria-label="Nova nota" onClick={createNote}>
                  <PlusIcon strokeWidth={1.75} />
                </Button>
              </div>
              {visible.length === 0 ? (
                <EmptyState icon={SearchIcon} title="Nenhuma nota" description="Crie uma nota ou mude a busca." />
              ) : (
                <div>
                  {visible.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setOpenId(n.id)
                        setEditing(false)
                      }}
                      aria-current={n.id === openId}
                      className={cn(
                        "flex w-full flex-col gap-1 border-b border-border px-1 py-3 text-left outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                        n.id === openId && "bg-muted"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {n.pinned ? <PinIcon aria-label="Fixada" strokeWidth={1.75} className="size-3.5 shrink-0" /> : null}
                        <span className="truncate text-[15px] leading-6 font-medium">{n.title || "Sem título"}</span>
                      </span>
                      <span className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                        {n.body.replace(/[#*\n-]+/g, " ").trim() || "Nota vazia"}
                      </span>
                      <span className="text-[13px] leading-5 text-muted-foreground">
                        {format(new Date(n.updated_at), "d 'de' MMM", { locale: ptBR })}
                        {n.tags.length > 0 ? ` · ${n.tags.map((t) => `#${t}`).join(" ")}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* editor */}
            <section className={cn("min-w-0", !open && "hidden md:block")}>
              {!open ? (
                <EmptyState icon={NotebookPenIcon} title="Selecione uma nota" description="Escolha uma nota na lista ou crie uma nova." />
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" aria-label="Voltar para a lista" className="md:hidden" onClick={() => setOpenId(null)}>
                      <ArrowLeftIcon strokeWidth={1.75} />
                    </Button>
                    <Input
                      aria-label="Título da nota"
                      value={open.title}
                      maxLength={120}
                      onChange={(e) => updateNote(open.id, { title: e.target.value })}
                      className="h-auto flex-1 border-transparent bg-transparent px-0 text-xl font-semibold tracking-[-0.01em] shadow-none md:text-xl dark:bg-transparent"
                    />
                    <Button variant="ghost" size="icon" aria-label={open.pinned ? "Desafixar" : "Fixar nota"} aria-pressed={open.pinned} onClick={() => updateNote(open.id, { pinned: !open.pinned })}>
                      <PinIcon strokeWidth={1.75} className={cn(open.pinned && "fill-current")} />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Mais opções">
                          <EllipsisIcon strokeWidth={1.75} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(open)}>
                          <Trash2Icon strokeWidth={1.75} /> Excluir nota
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1" role="toolbar" aria-label="Formatação">
                      <Button variant="ghost" size="icon-sm" aria-label="Título" onClick={() => { setEditing(true); insert("heading") }}>
                        <HeadingIcon strokeWidth={1.75} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Negrito" onClick={() => { setEditing(true); insert("bold") }}>
                        <BoldIcon strokeWidth={1.75} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Itálico" onClick={() => { setEditing(true); insert("italic") }}>
                        <ItalicIcon strokeWidth={1.75} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Lista" onClick={() => { setEditing(true); insert("list") }}>
                        <ListIcon strokeWidth={1.75} />
                      </Button>
                    </div>
                    <ToggleGroup type="single" variant="outline" size="sm" value={editing ? "edit" : "view"} onValueChange={(v) => v && setEditing(v === "edit")}>
                      <ToggleGroupItem value="view">Ler</ToggleGroupItem>
                      <ToggleGroupItem value="edit">Editar</ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {editing ? (
                    <Textarea
                      aria-label="Texto da nota"
                      value={open.body}
                      onChange={(e) => updateNote(open.id, { body: e.target.value })}
                      className="min-h-80 font-mono text-[14px] leading-6"
                      placeholder="Escreva aqui. Use # para títulos, - para listas, **negrito** e *itálico*."
                    />
                  ) : open.body.trim() ? (
                    <NotePreview source={open.body} />
                  ) : (
                    <p className="text-[15px] leading-6 text-muted-foreground">Nota vazia. Toque em “Editar” para escrever.</p>
                  )}

                  <p className="tabular text-[13px] leading-5 text-muted-foreground">
                    {wordCount(open.body)} palavras · salvo automaticamente · {mockFolders.find((f) => f.id === open.folder_id)?.name ?? "Sem pasta"}
                  </p>
                </div>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="lembretes" className="flex max-w-3xl flex-col gap-8 pt-6">
          <div>
            <Button onClick={() => setCreatingReminder(true)}>
              <PlusIcon strokeWidth={1.75} /> Novo lembrete
            </Button>
          </div>
          {groups.map((group) => (
            <section key={group.label} className="flex flex-col">
              <SectionTitle className="mb-1">{group.label}</SectionTitle>
              {group.items.map((r) => (
                <div key={r.id} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                  <Checkbox
                    checked={false}
                    aria-label={`Concluir ${r.title}`}
                    onCheckedChange={() => {
                      setReminders((current) => current.map((x) => (x.id === r.id ? { ...x, status: "done" } : x)))
                      toast("Lembrete concluído.")
                    }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] leading-6">{r.title}</span>
                    <span className="tabular flex flex-wrap items-center gap-x-3 text-[13px] leading-5 text-muted-foreground">
                      {formatDue({ due_at: r.remind_at, due_has_time: true }, now, MOCK_TIMEZONE)}
                      {r.channels.includes("push") ? (
                        <span className="inline-flex items-center gap-1">
                          <BellIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> App
                        </span>
                      ) : null}
                      {r.channels.includes("whatsapp") ? (
                        <span className="inline-flex items-center gap-1">
                          <MessageCircleIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> WhatsApp
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        Adiar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => snooze(r, 1)}>Em 1 hora</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => snooze(r, 3)}>Em 3 horas</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => snooze(r, 24)}>Amanhã</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </section>
          ))}
          {done.length > 0 ? (
            <section className="flex flex-col">
              <SectionTitle className="mb-1">Concluídos</SectionTitle>
              {done.map((r) => (
                <div key={r.id} className="flex min-h-12 items-center gap-4 border-b border-border py-2 text-muted-foreground last:border-b-0">
                  <Checkbox
                    checked
                    aria-label={`Reabrir ${r.title}`}
                    onCheckedChange={() => setReminders((current) => current.map((x) => (x.id === r.id ? { ...x, status: "pending" } : x)))}
                  />
                  <span className="flex-1 truncate text-[15px] leading-6 line-through">{r.title}</span>
                  <Badge variant="outline">Feito</Badge>
                </div>
              ))}
            </section>
          ) : null}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(openState) => !openState && setToDelete(null)}
        title="Excluir esta nota?"
        description={toDelete ? `“${toDelete.title}” será apagada. Essa ação não pode ser desfeita.` : ""}
        onConfirm={() => {
          const note = toDelete
          setToDelete(null)
          if (!note) return
          setNotes((current) => current.filter((n) => n.id !== note.id))
          setOpenId(null)
          toast("Nota excluída.")
        }}
      />
      <ReminderDialog
        open={creatingReminder}
        onOpenChange={setCreatingReminder}
        today={today}
        onCreate={(r) => {
          setReminders((current) => [...current, r])
          toast.success("Lembrete criado.")
        }}
      />
    </div>
  )
}

function ReminderDialog({
  open,
  onOpenChange,
  today,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  today: string
  onCreate: (reminder: ReminderRow) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <ReminderForm today={today} onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function ReminderForm({ today, onCreate, onClose }: { today: string; onCreate: (reminder: ReminderRow) => void; onClose: () => void }) {
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(today)
  const [time, setTime] = useState("09:00")
  const [channels, setChannels] = useState<string[]>(["push"])

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim() || channels.length === 0) return
        onCreate({
          id: mockId("rem"),
          user_id: USER,
          title: title.trim(),
          remind_at: toDueIso(date, time, MOCK_TIMEZONE),
          channels: channels as ReminderChannel[],
          status: "pending",
          note_id: null,
        })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Novo lembrete</DialogTitle>
        <DialogDescription className="sr-only">Defina o que lembrar, quando e onde avisar.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="rem-title">O que lembrar</Label>
        <Input id="rem-title" autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="rem-date">Data</Label>
          <Input id="rem-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rem-time">Hora</Label>
          <Input id="rem-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Avisar por</Label>
        <ToggleGroup type="multiple" variant="outline" value={channels} onValueChange={setChannels} className="justify-start">
          <ToggleGroupItem value="push">
            <BellIcon strokeWidth={1.75} /> App
          </ToggleGroupItem>
          <ToggleGroupItem value="whatsapp">
            <MessageCircleIcon strokeWidth={1.75} /> WhatsApp
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!title.trim() || channels.length === 0}>
          Criar lembrete
        </Button>
      </DialogFooter>
    </form>
  )
}
