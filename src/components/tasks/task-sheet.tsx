"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  CalendarIcon,
  CheckIcon,
  DownloadIcon,
  PaperclipIcon,
  PlusIcon,
  TagIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { BoardApi } from "@/features/tasks/board-api"
import { MAX_ATTACHMENT_BYTES } from "@/features/tasks/schemas"
import {
  PRIORITIES,
  PRIORITY_LABELS,
  asPriority,
  type AttachmentRow,
  type ChecklistItemRow,
  type CommentRow,
  type ListRow,
  type Priority,
  type TagRow,
  type TaskView,
} from "@/features/tasks/types"
import { splitDue, toDueIso } from "@/lib/dates"
import { SWATCH_IDS, getSwatch, type SwatchId } from "@/lib/swatches"
import { cn } from "@/lib/utils"

import { SwatchDot, TagChip } from "./task-meta"

type TaskSheetProps = {
  api: BoardApi
  task: TaskView | null
  lists: ListRow[]
  tags: TagRow[]
  timeZone: string
  onClose: () => void
  onTaskChange: (task: TaskView) => void
  onMoveToList: (task: TaskView, listId: string) => void
  onTagCreated: (tag: TagRow) => void
  onDelete: (task: TaskView) => void
  isMobile: boolean
  /** ≥1024 px: render as a side panel next to the board (no overlay) instead of a drawer. */
  panel?: boolean
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor} className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  )
}

/** Header and title: Radix dialog parts inside the drawer, plain elements inside the side panel (no dialog context there). */
function HeaderShell({ panel, className, children }: { panel?: boolean; className?: string; children: React.ReactNode }) {
  return panel ? <div className={className}>{children}</div> : <SheetHeader className={className}>{children}</SheetHeader>
}

function TitleShell({ panel, children }: { panel?: boolean; children: React.ReactNode }) {
  return panel ? (
    <h2 className="sr-only">{children}</h2>
  ) : (
    <>
      <SheetTitle className="sr-only">{children}</SheetTitle>
      <SheetDescription className="sr-only">Edite os detalhes da tarefa.</SheetDescription>
    </>
  )
}

function formatSize(bytes: number | null) {
  if (bytes == null) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
}

export function TaskSheet(props: TaskSheetProps) {
  const { task, onClose, panel } = props

  if (panel) {
    // The board stays visible and usable: this is a plain column, not a dialog.
    if (!task) return null
    return (
      <aside
        aria-label="Detalhes da tarefa"
        className="no-scrollbar sticky top-0 flex max-h-[calc(100dvh-8rem)] w-[clamp(340px,32vw,440px)] shrink-0 flex-col overflow-y-auto rounded-[24px] border border-border bg-card"
      >
        <TaskSheetBody key={task.id} {...props} task={task} />
      </aside>
    )
  }

  return (
    <Sheet open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        onOpenAutoFocus={(event) => event.preventDefault()}
        // Below 1024 px it is a full-screen drawer.
        className="data-[side=bottom]:h-dvh data-[side=bottom]:max-h-dvh gap-0 overflow-y-auto rounded-none p-0"
      >
        {/* Keyed by task so every task starts from fresh local state. */}
        {task ? <TaskSheetBody key={task.id} {...props} task={task} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function TaskSheetBody({
  api,
  task,
  lists,
  tags,
  timeZone,
  onTaskChange,
  onMoveToList,
  onTagCreated,
  onDelete,
  onClose,
  panel,
}: TaskSheetProps & { task: TaskView }) {
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<number | undefined>(undefined)
  function flashSaved() {
    setSaved(true)
    window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSaved(false), 1800)
  }
  useEffect(() => () => window.clearTimeout(savedTimer.current), [])
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [category, setCategory] = useState(task.category ?? "")
  const [checklist, setChecklist] = useState<ChecklistItemRow[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])
  const [attachments, setAttachments] = useState<AttachmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState("")
  const [newComment, setNewComment] = useState("")
  const [uploading, setUploading] = useState(false)
  const [removeFile, setRemoveFile] = useState<AttachmentRow | null>(null)
  const [dateOpen, setDateOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tagQuery, setTagQuery] = useState("")
  const taskRef = useRef(task)
  useEffect(() => {
    taskRef.current = task
  }, [task])

  useEffect(() => {
    let cancelled = false
    api.getTaskDetail(task.id).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setChecklist(result.data.checklist)
      setComments(result.data.comments)
      setAttachments(result.data.attachments)
    })
    return () => {
      cancelled = true
    }
  }, [task.id, api])

  async function patch(values: Parameters<BoardApi["updateTask"]>[0]["patch"]) {
    const result = await api.updateTask({ id: task.id, patch: values })
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    onTaskChange(result.data)
    flashSaved()
    return true
  }

  function syncCounters(next: { checklist?: ChecklistItemRow[]; comments?: CommentRow[]; attachments?: AttachmentRow[] }) {
    const c = next.checklist ?? checklist
    onTaskChange({
      ...taskRef.current,
      checklistTotal: c.length,
      checklistDone: c.filter((i) => i.done).length,
      commentCount: (next.comments ?? comments).length,
      attachmentCount: (next.attachments ?? attachments).length,
    })
  }

  const due = task.due_at ? splitDue(task.due_at, task.due_has_time, timeZone) : null
  const selectedTags = task.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is TagRow => Boolean(t))
  const checklistDone = checklist.filter((i) => i.done).length

  async function chooseDate(date: Date | undefined) {
    if (!date) return
    const day = format(date, "yyyy-MM-dd")
    await patch({ dueAt: toDueIso(day, due?.time ?? null, timeZone), dueHasTime: Boolean(due?.time) })
    setDateOpen(false)
  }

  async function changeTime(time: string) {
    if (!due) return
    if (!time) await patch({ dueAt: toDueIso(due.day, null, timeZone), dueHasTime: false })
    else await patch({ dueAt: toDueIso(due.day, time, timeZone), dueHasTime: true })
  }

  async function toggleTag(tag: TagRow) {
    const next = task.tagIds.includes(tag.id) ? task.tagIds.filter((id) => id !== tag.id) : [...task.tagIds, tag.id]
    onTaskChange({ ...task, tagIds: next })
    const result = await api.setTaskTags({ taskId: task.id, tagIds: next })
    if (!result.ok) {
      toast.error(result.error)
      onTaskChange({ ...task })
    }
  }

  async function makeTag() {
    const name = tagQuery.trim()
    if (!name) return
    const result = await api.createTag({ name })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    onTagCreated(result.data)
    setTagQuery("")
    await toggleTag(result.data)
  }

  async function addItem() {
    const text = newItem.trim()
    if (!text) return
    setNewItem("")
    const result = await api.addChecklistItem({ taskId: task.id, text })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    const next = [...checklist, result.data]
    setChecklist(next)
    syncCounters({ checklist: next })
  }

  async function toggleItem(item: ChecklistItemRow) {
    const next = checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i))
    setChecklist(next)
    syncCounters({ checklist: next })
    const result = await api.updateChecklistItem({ id: item.id, done: !item.done })
    if (!result.ok) {
      toast.error(result.error)
      setChecklist(checklist)
      syncCounters({ checklist })
    }
  }

  async function removeItem(item: ChecklistItemRow) {
    const next = checklist.filter((i) => i.id !== item.id)
    setChecklist(next)
    syncCounters({ checklist: next })
    const result = await api.deleteChecklistItem(item.id)
    if (!result.ok) {
      toast.error(result.error)
      setChecklist(checklist)
      syncCounters({ checklist })
    }
  }

  async function sendComment() {
    const body = newComment.trim()
    if (!body) return
    setNewComment("")
    const result = await api.addComment({ taskId: task.id, body })
    if (!result.ok) {
      toast.error(result.error)
      setNewComment(body)
      return
    }
    const next = [...comments, result.data]
    setComments(next)
    syncCounters({ comments: next })
  }

  async function removeComment(comment: CommentRow) {
    const next = comments.filter((c) => c.id !== comment.id)
    setComments(next)
    syncCounters({ comments: next })
    const result = await api.deleteComment(comment.id)
    if (!result.ok) {
      toast.error(result.error)
      setComments(comments)
      syncCounters({ comments })
    }
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    let current = attachments
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} passa de 10 MB.`)
        continue
      }
      const result = await api.uploadAttachment({ taskId: task.id, file })
      if (!result.ok) {
        toast.error(result.error)
        continue
      }
      current = [...current, result.data]
      setAttachments(current)
    }
    syncCounters({ attachments: current })
    setUploading(false)
  }

  async function download(file: AttachmentRow) {
    const result = await api.getAttachmentUrl(file.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    window.open(result.data.url, "_blank", "noopener")
  }

  async function confirmRemoveFile() {
    const file = removeFile
    setRemoveFile(null)
    if (!file) return
    const result = await api.deleteAttachment(file.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    const next = attachments.filter((a) => a.id !== file.id)
    setAttachments(next)
    syncCounters({ attachments: next })
    toast("Anexo removido.")
  }

  return (
    <>
      <HeaderShell panel={panel} className="sticky top-0 z-10 gap-1 border-b border-border bg-card p-4 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <span role="status" aria-live="polite" className="inline-flex h-5 items-center gap-1 text-[13px] leading-5 text-muted-foreground">
            {saved ? (
              <>
                <CheckIcon aria-hidden strokeWidth={2} className="size-3.5" /> Salvo
              </>
            ) : (
              "Alterações são salvas sozinhas"
            )}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Fechar detalhes" onClick={onClose}>
            <XIcon strokeWidth={1.75} />
          </Button>
        </div>
        <TitleShell panel={panel}>Tarefa: {task.title}</TitleShell>
        <Input
          aria-label="Título da tarefa"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={async () => {
            const value = title.trim()
            if (!value) return setTitle(task.title)
            if (value !== task.title) await patch({ title: value })
          }}
          className="h-auto border-transparent bg-transparent px-0 text-xl font-semibold tracking-[-0.01em] shadow-none md:text-xl dark:bg-transparent"
        />
      </HeaderShell>

      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Lista" htmlFor="task-list">
            <Select value={task.list_id} onValueChange={(listId) => onMoveToList(task, listId)}>
              <SelectTrigger id="task-list" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prioridade" htmlFor="task-priority">
            <Select value={asPriority(task.priority)} onValueChange={(v) => patch({ priority: v as Priority })}>
              <SelectTrigger id="task-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Entrega">
            <div className="flex gap-2">
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-0 flex-1 justify-start font-normal">
                    <CalendarIcon strokeWidth={1.75} />
                    <span className="truncate">
                      {due ? format(new Date(`${due.day}T12:00:00`), "dd/MM/yyyy") : "Sem data"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    locale={ptBR}
                    selected={due ? new Date(`${due.day}T12:00:00`) : undefined}
                    onSelect={chooseDate}
                  />
                </PopoverContent>
              </Popover>
              {due ? (
                <Button variant="ghost" size="icon" aria-label="Remover data" onClick={() => patch({ dueAt: null })}>
                  <XIcon strokeWidth={1.75} />
                </Button>
              ) : null}
            </div>
          </Field>
          <Field label="Hora" htmlFor="task-time">
            <Input
              id="task-time"
              type="time"
              disabled={!due}
              value={due?.time ?? ""}
              onChange={(e) => void changeTime(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lembrete" htmlFor="task-reminder">
              <Select value="none" disabled>
                <SelectTrigger id="task-reminder" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem lembrete</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Repetir" htmlFor="task-repeat">
              <Select value="none" disabled>
                <SelectTrigger id="task-repeat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não repete</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <p className="text-[13px] leading-5 text-muted-foreground">Em breve: avisos pelo WhatsApp e tarefas que se repetem.</p>
        </div>

        <Field label="Descrição" htmlFor="task-description">
          <Textarea
            id="task-description"
            value={description}
            placeholder="Acrescente detalhes"
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== (task.description ?? "")) void patch({ description: description.trim() || null })
            }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoria" htmlFor="task-category">
            <Input
              id="task-category"
              value={category}
              maxLength={60}
              placeholder="Ex.: Trabalho"
              onChange={(e) => setCategory(e.target.value)}
              onBlur={() => {
                if (category.trim() !== (task.category ?? "")) void patch({ category: category.trim() || null })
              }}
            />
          </Field>
          <Field label="Cor">
            <div role="radiogroup" aria-label="Cor da tarefa" className="flex min-h-11 flex-wrap items-center gap-2 md:min-h-9">
              {SWATCH_IDS.map((id: SwatchId) => {
                const selected = task.swatch === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={getSwatch(id).label}
                    title={getSwatch(id).label}
                    onClick={() => patch({ swatch: id })}
                    className={cn(
                      "relative flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      "after:absolute after:-inset-1.5"
                    )}
                  >
                    <SwatchDot swatch={id} className="size-6" />
                    {selected ? (
                      <CheckIcon
                        aria-hidden
                        strokeWidth={2}
                        className={cn(
                          "absolute size-3.5",
                          id === "grafite" || id === "tinta-verso" ? "text-palette-papel" : "text-palette-tinta",
                          id === "neutro" && "text-foreground"
                        )}
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        <Field label="Tags">
          <div className="flex flex-wrap items-center gap-2">
            {selectedTags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
            <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <TagIcon strokeWidth={1.75} /> {selectedTags.length > 0 ? "Editar" : "Adicionar tag"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-0">
                <Command>
                  <CommandInput placeholder="Buscar ou criar tag" value={tagQuery} onValueChange={setTagQuery} />
                  <CommandList>
                    <CommandEmpty>Nenhuma tag.</CommandEmpty>
                    <CommandGroup>
                      {tags.map((tag) => (
                        <CommandItem key={tag.id} value={tag.name} onSelect={() => void toggleTag(tag)}>
                          <SwatchDot swatch={tag.swatch} />
                          {tag.name}
                          {task.tagIds.includes(tag.id) ? <CheckIcon strokeWidth={1.75} className="ml-auto" /> : null}
                        </CommandItem>
                      ))}
                      {tagQuery.trim() && !tags.some((t) => t.name.toLowerCase() === tagQuery.trim().toLowerCase()) ? (
                        <CommandItem value={`criar-${tagQuery}`} onSelect={() => void makeTag()}>
                          <PlusIcon strokeWidth={1.75} /> Criar “{tagQuery.trim()}”
                        </CommandItem>
                      ) : null}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </Field>

        <Field label="Checklist">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex flex-col gap-1">
              {checklist.length > 0 ? (
                <div className="mb-2 flex items-center gap-3">
                  <Progress value={(checklistDone / checklist.length) * 100} />
                  <span className="tabular text-[13px] leading-5 text-muted-foreground">
                    {checklistDone}/{checklist.length}
                  </span>
                </div>
              ) : null}
              {checklist.map((item) => (
                <div key={item.id} className="flex min-h-11 items-center gap-3">
                  <Checkbox checked={item.done} onCheckedChange={() => void toggleItem(item)} aria-label={item.text} />
                  <span className={cn("flex-1 text-[15px] leading-6", item.done && "text-muted-foreground line-through")}>
                    {item.text}
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remover ${item.text}`} onClick={() => void removeItem(item)}>
                    <XIcon strokeWidth={1.75} />
                  </Button>
                </div>
              ))}
              <form
                className="flex gap-2 pt-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  void addItem()
                }}
              >
                <Input
                  value={newItem}
                  placeholder="Novo item"
                  aria-label="Novo item do checklist"
                  maxLength={300}
                  onChange={(e) => setNewItem(e.target.value)}
                />
                <Button type="submit" variant="outline" size="icon" aria-label="Adicionar item" disabled={!newItem.trim()}>
                  <PlusIcon strokeWidth={1.75} />
                </Button>
              </form>
            </div>
          )}
        </Field>

        <Field label="Anexos">
          <div className="flex flex-col gap-1">
            {attachments.map((file) => (
              <div key={file.id} className="flex min-h-11 items-center gap-3 border-b border-border">
                <PaperclipIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[15px] leading-6">{file.file_name}</span>
                <span className="tabular text-[13px] leading-5 text-muted-foreground">{formatSize(file.size_bytes)}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Baixar ${file.file_name}`} onClick={() => void download(file)}>
                  <DownloadIcon strokeWidth={1.75} />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Remover ${file.file_name}`} onClick={() => setRemoveFile(file)}>
                  <Trash2Icon strokeWidth={1.75} />
                </Button>
              </div>
            ))}
            <label className="inline-flex">
              <input type="file" multiple className="sr-only peer" disabled={uploading} onChange={(e) => { void upload(e.target.files); e.target.value = "" }} />
              <span className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:opacity-50 md:h-9 md:px-3">
                <PaperclipIcon strokeWidth={1.75} className="size-4" /> {uploading ? "Enviando…" : "Anexar arquivo"}
              </span>
            </label>
            <span className="text-[13px] leading-5 text-muted-foreground">Até 10 MB por arquivo.</span>
          </div>
        </Field>

        <Field label="Comentários">
          <div className="flex flex-col gap-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3 border-b border-border pb-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] leading-6 break-words whitespace-pre-wrap">{comment.body}</span>
                  <span className="tabular text-[13px] leading-5 text-muted-foreground">
                    {format(new Date(comment.created_at), "d MMM, HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Remover comentário" onClick={() => void removeComment(comment)}>
                  <XIcon strokeWidth={1.75} />
                </Button>
              </div>
            ))}
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void sendComment()
              }}
            >
              <Textarea
                value={newComment}
                placeholder="Escreva um comentário"
                aria-label="Novo comentário"
                onChange={(e) => setNewComment(e.target.value)}
              />
              <Button type="submit" variant="outline" className="self-end" disabled={!newComment.trim()}>
                Comentar
              </Button>
            </form>
          </div>
        </Field>

        <div className="border-t border-border pt-4">
          <Button variant="destructive" onClick={() => onDelete(task)}>
            <Trash2Icon strokeWidth={1.75} /> Excluir tarefa
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(removeFile)}
        onOpenChange={(open) => !open && setRemoveFile(null)}
        title="Remover este anexo?"
        description={removeFile ? `${removeFile.file_name} será apagado. Essa ação não pode ser desfeita.` : ""}
        confirmLabel="Remover"
        onConfirm={() => void confirmRemoveFile()}
      />
    </>
  )
}
