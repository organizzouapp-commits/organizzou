"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowLeftIcon,
  BellIcon,
  BoldIcon,
  EllipsisIcon,
  FolderIcon,
  HeadingIcon,
  InfoIcon,
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
import { BentoCard, bentoCardClass } from "@/components/organizzou/Bento"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
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
  DropdownMenuLabel,
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

  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(savedTimer.current), [])

  function updateNote(id: string, patch: Partial<NoteRow>) {
    setSaved(true)
    window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSaved(false), 1800)
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

  usePrimaryAction("Nova nota", createNote)

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
    <div className="flex flex-col gap-5">
      <PageHeader />

      <Tabs defaultValue="notas">
        <TabsList>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="lembretes">Lembretes</TabsTrigger>
        </TabsList>

        <TabsContent value="notas" className="pt-5">
          <div className="grid gap-5 md:h-[calc(100dvh-17rem)] md:min-h-[34rem] md:grid-cols-[13rem_minmax(0,20rem)_minmax(0,1fr)]">
            {/* folders */}
            <nav aria-label="Pastas" className={cn(bentoCardClass(), "flex flex-col gap-1 overflow-y-auto p-4", open && "hidden md:flex")}>
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
            <section aria-label="Lista de notas" className={cn(bentoCardClass(), "flex min-h-0 flex-col gap-3 p-4", open && "hidden md:flex")}>
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
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
                  {visible.some((n) => n.pinned) ? <p className="px-1 pt-1 pb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Fixadas</p> : null}
                  {visible.map((n, index) => (
                    <Fragment key={n.id}>
                      {index > 0 && visible[index - 1].pinned && !n.pinned ? (
                        <p className="px-1 pt-4 pb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Notas</p>
                      ) : null}
                    <button
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
                    </Fragment>
                  ))}
                </div>
              )}
            </section>

            {/* editor */}
            <section aria-label="Editor" className={cn(bentoCardClass(), "flex min-h-0 flex-col overflow-y-auto", !open && "hidden md:flex")}>
              {!open ? (
                <EmptyState icon={NotebookPenIcon} title="Selecione uma nota" description="Escolha uma nota na lista ou crie uma nova." />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4">
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
                      className="min-h-80 flex-1 resize-none font-mono text-[14px] leading-6"
                      placeholder="Escreva aqui. Use # para títulos, - para listas, **negrito** e *itálico*."
                    />
                  ) : open.body.trim() ? (
                    <NotePreview source={open.body} />
                  ) : (
                    <p className="text-[15px] leading-6 text-muted-foreground">Nota vazia. Toque em “Editar” para escrever.</p>
                  )}

                  <p className="tabular text-[13px] leading-5 text-muted-foreground">
                    {wordCount(open.body)} palavras · {mockFolders.find((f) => f.id === open.folder_id)?.name ?? "Sem pasta"} ·{" "}
                    <span role="status" aria-live="polite">{saved ? "Salvo" : "Alterações são salvas sozinhas"}</span>
                  </p>
                </div>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="lembretes" className="pt-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex max-w-[72ch] items-start gap-2 text-[13px] leading-5 text-muted-foreground">
                <InfoIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
                Em breve: os lembretes serão avisados pelo app e pelo WhatsApp. Por enquanto eles ficam só aqui, na lista.
              </p>
              <Button variant="outline" onClick={() => setCreatingReminder(true)}>
                <PlusIcon strokeWidth={1.75} /> Novo lembrete
              </Button>
            </div>
            <div className="grid items-start gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))" }}>
              {groups.map((group) => (
                <BentoCard key={group.label} title={group.label}>
                  {group.items.map((r) => (
                    <div key={r.id} className="flex min-h-14 items-start gap-3 border-b border-border py-3 last:border-b-0">
                      <Checkbox
                        checked={false}
                        aria-label={`Concluir ${r.title}`}
                        className="mt-1"
                        onCheckedChange={() => {
                          setReminders((current) => current.map((x) => (x.id === r.id ? { ...x, status: "done" } : x)))
                          toast("Lembrete concluído.")
                        }}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[15px] leading-6 break-words">{r.title}</span>
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
                          <Button variant="ghost" size="icon-sm" aria-label={`Mais opções de ${r.title}`}>
                            <EllipsisIcon strokeWidth={1.75} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Adiar</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => snooze(r, 1)}>Em 1 hora</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => snooze(r, 3)}>Em 3 horas</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => snooze(r, 24)}>Amanhã</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </BentoCard>
              ))}
              {done.length > 0 ? (
                <BentoCard title="Concluídos">
                  {done.map((r) => (
                    <div key={r.id} className="flex min-h-12 items-start gap-3 border-b border-border py-2.5 text-muted-foreground last:border-b-0">
                      <Checkbox
                        checked
                        aria-label={`Reabrir ${r.title}`}
                        className="mt-1"
                        onCheckedChange={() => setReminders((current) => current.map((x) => (x.id === r.id ? { ...x, status: "pending" } : x)))}
                      />
                      <span className="flex-1 text-[15px] leading-6 break-words line-through">{r.title}</span>
                      <Badge variant="outline">Feito</Badge>
                    </div>
                  ))}
                </BentoCard>
              ) : null}
            </div>
          </div>
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
