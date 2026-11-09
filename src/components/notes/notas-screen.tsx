"use client"

import { useEffect, useState } from "react"
import { EllipsisIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { InfoLine, LembretesTab } from "@/components/notes/lembretes-tab"
import { NotasTab } from "@/components/notes/notas-tab"
import { RescheduleSheet, ReminderSheet, blankDraft, draftInstant, draftOf, type ReminderDraft } from "@/components/notes/reminder-sheets"
import { useNotes } from "@/components/notes/use-notes"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useIsMobile } from "@/hooks/use-mobile"
import type { NoteFolderRow, NoteRow, ReminderRow } from "@/features/notes/types"
import { groupReminders, localReminderMetaRepo, nextOccurrence, parseReminderText, type ReminderMetaMap } from "@/features/notes/reminders"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import { newId } from "@/lib/sp-time"

const USER = "00000000-0000-4000-8000-000000000001"

type TabId = "notas" | "lembretes"
const TAB_ITEMS = [
  { id: "notas", label: "Notas" },
  { id: "lembretes", label: "Lembretes" },
]

export type NotesInitial = { folders: NoteFolderRow[]; notes: NoteRow[]; reminders: ReminderRow[] }

export function NotasScreen({ nowIso, initial }: { nowIso: string; initial: NotesInitial }) {
  const now = new Date(nowIso)
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<TabId>("notas")
  // Typing in a note is saved after a short pause; every other change is saved at once.
  const [notes, setNotes] = usePersistedRows<NoteRow>("notes", initial.notes, { debounceMs: 800 })
  const [reminders, setReminders] = usePersistedRows<ReminderRow>("reminders", initial.reminders)
  const [folders, setFolders] = usePersistedRows<NoteFolderRow>("note_folders", initial.folders)
  const [reminderDraft, setReminderDraft] = useState<ReminderDraft | null>(null)
  const [rescheduling, setRescheduling] = useState<{ ids: string[]; title: string } | null>(null)
  const [reminderMetas, setReminderMetas] = useState<ReminderMetaMap>({})
  useEffect(() => {
    // localStorage only exists in the browser; read after mount so the server and the first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReminderMetas(localReminderMetaRepo.load())
  }, [])
  const updateMetas = (change: (current: ReminderMetaMap) => ReminderMetaMap) =>
    setReminderMetas((current) => {
      const next = change(current)
      localReminderMetaRepo.save(next)
      return next
    })
  const c = useNotes({ notes, setNotes, folders, setFolders })

  // The top bar's primary button follows the tab.
  usePrimaryAction(tab === "notas" ? "Nova nota" : "Novo lembrete", () => (tab === "notas" ? c.createNote() : setReminderDraft(blankDraft(now))))

  const tabs = <PillTabs className={isMobile ? "w-full" : "w-fit max-w-full"} ariaLabel="Notas e lembretes" items={TAB_ITEMS} value={tab} onSelect={(item) => {
    // Leaving the Notas tab drops an empty draft.
    if (item.id !== "notas") c.close()
    setTab(item.id as TabId)
  }} />

  // ---------------------------------------------------------- reminders
  /** "Pagar boleto amanhã às 9h" creates the reminder; a text that carries no date or time opens the dialog with the title filled in. */
  function quickReminder(text: string) {
    if (!text) return setReminderDraft(blankDraft(now))
    const { title, remindAt } = parseReminderText(text, now)
    if (remindAt && title) {
      setReminders((current) => [...current, { id: newId(), user_id: USER, title, remind_at: remindAt, channels: ["push"], status: "pending", note_id: null }])
      toast.success("Lembrete criado.")
      return
    }
    const draft = blankDraft(now, title)
    if (remindAt) {
      const when = draftOf({ id: "", title, remind_at: remindAt }, undefined)
      setReminderDraft({ ...draft, date: when.date, time: when.time, quick: null })
    } else setReminderDraft(draft)
  }

  function saveReminder(draft: ReminderDraft) {
    const remind_at = draftInstant(draft)
    const id = draft.id ?? newId()
    if (draft.id) setReminders((current) => current.map((r) => (r.id === id ? { ...r, title: draft.title, remind_at } : r)))
    else setReminders((current) => [...current, { id, user_id: USER, title: draft.title, remind_at, channels: ["push"], status: "pending", note_id: null }])
    updateMetas((current) => ({ ...current, [id]: { repeat: draft.repeat === "none" ? undefined : draft.repeat, advance: draft.advance === 0 ? undefined : draft.advance } }))
    toast.success(draft.id ? "Lembrete atualizado." : "Lembrete criado.")
  }

  /** Completing a repeating reminder creates its next occurrence; "Desfazer" brings the original back and removes that copy. */
  function toggleReminder(row: ReminderRow) {
    if (row.status === "done") {
      setReminders((current) => current.map((r) => (r.id === row.id ? { ...r, status: "pending" } : r)))
      return
    }
    const meta = reminderMetas[row.id]
    const next = nextOccurrence(row.remind_at, meta?.repeat ?? "none", now)
    const copyId = next ? newId() : null
    setReminders((current) => {
      const done = current.map((r) => (r.id === row.id ? { ...r, status: "done" as const } : r))
      return next && copyId ? [...done, { ...row, id: copyId, remind_at: next, status: "pending" as const }] : done
    })
    if (next && copyId && meta) updateMetas((current) => ({ ...current, [copyId]: meta }))
    toast("Lembrete concluído.", {
      action: {
        label: "Desfazer",
        onClick: () => {
          setReminders((current) => current.filter((r) => r.id !== copyId).map((r) => (r.id === row.id ? { ...r, status: "pending" as const } : r)))
          if (copyId) updateMetas((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== copyId)))
        },
      },
    })
  }

  function applyReschedule(iso: string) {
    const ids = new Set(rescheduling?.ids ?? [])
    setReminders((current) => current.map((r) => (ids.has(r.id) ? { ...r, remind_at: iso, status: "pending" } : r)))
    toast(ids.size === 1 ? "Lembrete reagendado." : `${ids.size} lembretes reagendados.`)
  }

  function deleteReminder(row: ReminderRow) {
    setReminders((current) => current.filter((r) => r.id !== row.id))
    updateMetas((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== row.id)))
    toast("Lembrete excluído.")
  }

  function clearDone() {
    setReminders((current) => current.filter((r) => r.status !== "done"))
    toast("Concluídos removidos.")
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
                <DropdownMenuItem onSelect={() => setReminderDraft(blankDraft(now))}>
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
          {tab === "lembretes" ? <InfoLine /> : null}
          {tab === "notas" ? (
            <Button type="button" data-testid="new-note" onClick={c.createNote} className="h-9 rounded-full bg-highlight px-4 text-highlight-foreground hover:bg-highlight/90">
              <PlusIcon strokeWidth={1.75} /> Nova nota
            </Button>
          ) : null}
        </div>
      )}

      {tab === "notas" ? <NotasTab c={c} isMobile={isMobile} /> : null}

      {tab === "lembretes" ? (
        <LembretesTab
          reminders={reminders}
          metas={reminderMetas}
          now={now}
          isMobile={isMobile}
          onQuick={quickReminder}
          onEdit={(row) => setReminderDraft(draftOf(row, reminderMetas[row.id]))}
          onReschedule={(row) => setRescheduling({ ids: [row.id], title: row.title })}
          onRescheduleOverdue={() => {
            const ids = groupReminders(reminders, now).overdue.map((r) => r.id)
            if (ids.length > 0) setRescheduling({ ids, title: "" })
          }}
          onToggle={toggleReminder}
          onDelete={deleteReminder}
          onClearDone={clearDone}
        />
      ) : null}

      <ReminderSheet draft={reminderDraft} now={now} onClose={() => setReminderDraft(null)} onSave={saveReminder} />
      <RescheduleSheet target={rescheduling ? { count: rescheduling.ids.length, title: rescheduling.title } : null} now={now} onClose={() => setRescheduling(null)} onApply={applyReschedule} />
    </div>
  )
}
