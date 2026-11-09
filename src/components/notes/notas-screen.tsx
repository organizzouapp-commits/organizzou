"use client"

import { useState } from "react"
import { BellIcon, EllipsisIcon, InfoIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { BentoCard } from "@/components/organizzou/Bento"
import { NotasTab } from "@/components/notes/notas-tab"
import { useNotes } from "@/components/notes/use-notes"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { PillTabs } from "@/components/tasks/pill-tabs"
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
import { useIsMobile } from "@/hooks/use-mobile"
import type { NoteFolderRow, NoteRow, ReminderRow } from "@/features/notes/types"
import { dayDiff, formatDue, toDueIso } from "@/lib/dates"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import { dayOf, SP_TIMEZONE, newId } from "@/lib/sp-time"

const USER = "00000000-0000-4000-8000-000000000001"

type TabId = "notas" | "lembretes"
const TAB_ITEMS = [
  { id: "notas", label: "Notas" },
  { id: "lembretes", label: "Lembretes" },
]

export type NotesInitial = { folders: NoteFolderRow[]; notes: NoteRow[]; reminders: ReminderRow[] }

export function NotasScreen({ nowIso, initial }: { nowIso: string; initial: NotesInitial }) {
  const today = dayOf(nowIso)
  const now = new Date(nowIso)
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<TabId>("notas")
  // Typing in a note is saved after a short pause; every other change is saved at once.
  const [notes, setNotes] = usePersistedRows<NoteRow>("notes", initial.notes, { debounceMs: 800 })
  const [reminders, setReminders] = usePersistedRows<ReminderRow>("reminders", initial.reminders)
  const [folders, setFolders] = usePersistedRows<NoteFolderRow>("note_folders", initial.folders)
  const [creatingReminder, setCreatingReminder] = useState(false)
  const c = useNotes({ notes, setNotes, folders, setFolders })

  // The top bar's primary button follows the tab.
  usePrimaryAction(tab === "notas" ? "Nova nota" : "Novo lembrete", () => (tab === "notas" ? c.createNote() : setCreatingReminder(true)))

  const tabs = <PillTabs className={isMobile ? "w-full" : "w-fit max-w-full"} ariaLabel="Notas e lembretes" items={TAB_ITEMS} value={tab} onSelect={(item) => {
    // Leaving the Notas tab drops an empty draft.
    if (item.id !== "notas") c.close()
    setTab(item.id as TabId)
  }} />

  // ---------------------------------------------------------- reminders
  const pending = reminders.filter((r) => r.status === "pending").sort((a, b) => a.remind_at.localeCompare(b.remind_at))
  const done = reminders.filter((r) => r.status === "done")
  const groupOf = (r: ReminderRow) => {
    const diff = dayDiff(r.remind_at, now, SP_TIMEZONE)
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
    <div className="flex min-w-0 flex-col gap-4" data-testid="notas" data-tab={tab}>
      <PageHeader />

      {isMobile ? (
        <section aria-label="Notas e lembretes" data-testid="notas-header-block" className="mt-3 flex flex-col gap-2 rounded-[20px] border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[18px] leading-6 font-semibold">Notas e lembretes</h2>
              <p className="truncate text-[13px] leading-5 text-muted-foreground">Anote agora, encontre depois.</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Opções de notas e lembretes" data-testid="notas-options" className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-1">
                  <EllipsisIcon strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setTab("notas")
                    c.createNote()
                  }}
                >
                  <PlusIcon strokeWidth={1.75} /> Nova nota
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCreatingReminder(true)}>
                  <PlusIcon strokeWidth={1.75} /> Novo lembrete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {tabs}
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {tabs}
          {tab === "notas" ? (
            <Button type="button" data-testid="new-note" onClick={c.createNote} className="h-9 rounded-full bg-highlight px-4 text-highlight-foreground hover:bg-highlight/90">
              <PlusIcon strokeWidth={1.75} /> Nova nota
            </Button>
          ) : null}
        </div>
      )}

      {tab === "notas" ? <NotasTab c={c} isMobile={isMobile} /> : null}

      {tab === "lembretes" ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex max-w-[72ch] items-start gap-2 text-[13px] leading-5 text-muted-foreground">
              <InfoIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
              Os lembretes avisam você pelo app, na hora marcada.
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
                        {formatDue({ due_at: r.remind_at, due_has_time: true }, now, SP_TIMEZONE)}
                        {r.channels.includes("push") ? (
                          <span className="inline-flex items-center gap-1">
                            <BellIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> App
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
      ) : null}

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

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return
        onCreate({
          id: newId(),
          user_id: USER,
          title: title.trim(),
          remind_at: toDueIso(date, time, SP_TIMEZONE),
          channels: ["push"],
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
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!title.trim()}>
          Criar lembrete
        </Button>
      </DialogFooter>
    </form>
  )
}
