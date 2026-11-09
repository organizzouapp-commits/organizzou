"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ClipboardCopyIcon, MoonIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { BentoCard } from "@/components/finance/bento"
import { LIST_CARD } from "@/components/finance/parts"
import { ActionMenu, type ActionItem } from "@/components/organizzou/action-menu"
import { MOOD_ICONS, MoodPicker, SleepRow } from "@/components/journal/mood-picker"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StickyFooter } from "@/components/workouts/sheet-fields"
import { sleepText, visibleEntries } from "@/features/journal/stats"
import { MOOD_LABELS, type JournalDay, type Mood } from "@/features/journal/types"
import { cn } from "@/lib/utils"

const chip = "tabular inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const entryTitle = (day: string) => capitalize(format(parseISO(day), "EEEE, d MMM", { locale: ptBR }).replace(".", "").replace("-feira", ""))

// ------------------------------------------------------------------ one entry

function EntryCard({ entry, mobile, onEdit, onCopy, onDelete }: { entry: JournalDay; mobile: boolean; onEdit: () => void; onCopy: () => void; onDelete: () => void }) {
  const Icon = MOOD_ICONS[entry.mood]
  const great = entry.mood === 5
  const items: ActionItem[] = [
    { label: "Editar registro", icon: PencilIcon, run: onEdit },
    { label: "Copiar anotação", icon: ClipboardCopyIcon, run: onCopy },
    { label: "Excluir registro", icon: Trash2Icon, run: onDelete, separated: true },
  ]
  const moodChip = (
    <span data-chip="mood" data-great={great} className={cn("tabular inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[12px] leading-4 whitespace-nowrap", great ? "bg-highlight font-semibold text-highlight-foreground" : "border border-foreground/25 text-muted-foreground")}>
      {MOOD_LABELS[entry.mood]}
    </span>
  )
  const sleepChip = entry.sleep_hours ? (
    <span data-chip="sleep" className={chip}>
      <MoonIcon aria-hidden strokeWidth={1.75} className="size-3" /> {sleepText(entry.sleep_hours)}
    </span>
  ) : null
  return (
    <li data-entry={entry.entry_date} className={cn(LIST_CARD, "flex min-h-16 min-w-0 items-center gap-3 py-2 pr-1 pl-3")}>
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border">
        <Icon strokeWidth={1.75} className="size-[18px]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[14px] leading-5 font-semibold">{entryTitle(entry.entry_date)}</span>
          {mobile ? null : moodChip}
          {mobile ? null : sleepChip}
        </div>
        {mobile ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {moodChip}
            {sleepChip}
          </div>
        ) : null}
        {entry.text ? <span className="truncate text-[13px] leading-5 text-muted-foreground">{entry.text}</span> : null}
      </div>
      <ActionMenu items={items} mobile={mobile} ariaLabel={`Opções do registro de ${entryTitle(entry.entry_date)}`} title={entryTitle(entry.entry_date)} />
    </li>
  )
}

// ------------------------------------------------------------------ the list

/** "Últimos registros": each day as its own card, 8 at first (6 on phones) and 8 more at every "Ver mais registros". */
export function EntriesList({ entries, mobile, onEdit, onCopy, onDelete }: { entries: JournalDay[]; mobile: boolean; onEdit: (entry: JournalDay) => void; onCopy: (entry: JournalDay) => void; onDelete: (entry: JournalDay) => void }) {
  const [pages, setPages] = useState(0)
  const { items, hasMore } = visibleEntries(entries, mobile ? 6 : 8, 8, pages)
  return (
    <BentoCard title="Últimos registros" data-testid="journal-entries" actions={<span data-chip className={chip}>{entries.length} no total</span>}>
      {items.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhum check-in ainda. Faça o primeiro acima.</p> : null}
      <ul className={cn("grid gap-3", mobile ? "grid-cols-1" : "grid-cols-2")}>
        {items.map((entry) => (
          <EntryCard key={entry.id} entry={entry} mobile={mobile} onEdit={() => onEdit(entry)} onCopy={() => onCopy(entry)} onDelete={() => onDelete(entry)} />
        ))}
      </ul>
      {hasMore ? (
        <div className="flex justify-center pt-1">
          <Button type="button" variant="outline" data-testid="more-entries" onClick={() => setPages((p) => p + 1)} className="h-11 rounded-full px-6">
            Ver mais registros
          </Button>
        </div>
      ) : null}
    </BentoCard>
  )
}

// ------------------------------------------------------------------ edit dialog

export type EntryValues = { mood: Mood; text: string; sleep_hours: number }

/** "Editar registro": a dialog on desktop, a bottom sheet on phones. Saves through the same rows as the check-in; the stored shape does not change. */
export function EditEntrySheet({ entry, mobile, onClose, onSave, onDelete }: { entry: JournalDay | null; mobile: boolean; onClose: () => void; onSave: (entry: JournalDay, values: EntryValues) => void; onDelete: (entry: JournalDay) => void }) {
  return (
    <ResponsiveSheet open={Boolean(entry)} onOpenChange={(open) => !open && onClose()} title="Editar registro" description={entry ? format(parseISO(entry.entry_date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }) : undefined}>
      {entry ? <EditForm key={entry.id} entry={entry} mobile={mobile} onClose={onClose} onSave={onSave} onDelete={onDelete} /> : null}
    </ResponsiveSheet>
  )
}

function EditForm({ entry, mobile, onClose, onSave, onDelete }: { entry: JournalDay; mobile: boolean; onClose: () => void; onSave: (entry: JournalDay, values: EntryValues) => void; onDelete: (entry: JournalDay) => void }) {
  const [mood, setMood] = useState<Mood>(entry.mood)
  const [text, setText] = useState(entry.text)
  const [sleep, setSleep] = useState(entry.sleep_hours ?? 7)
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(entry, { mood, text: text.trim(), sleep_hours: sleep })
        onClose()
      }}
    >
      <div className="flex flex-col gap-2">
        <Label>Humor</Label>
        <MoodPicker value={mood} onChange={setMood} label="Humor do dia" mobile={mobile} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="entry-text">Anotação</Label>
        <Textarea id="entry-text" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} className="min-h-24 rounded-[12px] px-3 py-2.5 text-[15px] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" />
      </div>
      <SleepRow value={sleep} onChange={setSleep} />
      <StickyFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onClose()
            onDelete(entry)
          }}
        >
          <Trash2Icon strokeWidth={1.75} /> Excluir
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-highlight text-highlight-foreground hover:bg-highlight/90">
          Salvar
        </Button>
      </StickyFooter>
    </form>
  )
}
