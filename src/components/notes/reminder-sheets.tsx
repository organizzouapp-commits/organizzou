"use client"

import { useState } from "react"
import { format } from "date-fns"

import { DatePickerField } from "@/components/organizzou/date-picker-field"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fieldClass, pillBase, pillOff, pillOn, StickyFooter } from "@/components/workouts/sheet-fields"
import { ADVANCE_OPTIONS, QUICK_OPTIONS, REPEAT_OPTIONS, quickOption, type AdvanceMinutes, type QuickKind, type RepeatRule } from "@/features/notes/reminders"
import { dayKey, inTz, toDueIso } from "@/lib/dates"
import { SP_TIMEZONE } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

const LIMA_BUTTON = "bg-highlight text-highlight-foreground hover:bg-highlight/90"

export type ReminderDraft = { id?: string; title: string; date: string; time: string; quick: QuickKind | null; repeat: RepeatRule; advance: AdvanceMinutes }

/** A new draft: today at the next round hour, with the "Hoje" shortcut on. */
export function blankDraft(now: Date, title = ""): ReminderDraft {
  const { date, time } = quickOption("today", now)
  return { title, date, time, quick: "today", repeat: "none", advance: 0 }
}

/** A draft for an existing reminder (editing). */
export function draftOf(row: { id: string; title: string; remind_at: string }, meta: { repeat?: RepeatRule; advance?: AdvanceMinutes } | undefined): ReminderDraft {
  return { id: row.id, title: row.title, date: dayKey(row.remind_at, SP_TIMEZONE), time: format(inTz(row.remind_at, SP_TIMEZONE), "HH:mm"), quick: null, repeat: meta?.repeat ?? "none", advance: meta?.advance ?? 0 }
}

export const draftInstant = (d: Pick<ReminderDraft, "date" | "time">) => toDueIso(d.date, d.time || "09:00", SP_TIMEZONE)

// ------------------------------------------------------------------ "Quando": shortcuts + date + time

function WhenFields({ now, value, onChange, minDate }: { now: Date; value: Pick<ReminderDraft, "date" | "time" | "quick">; onChange: (patch: Pick<ReminderDraft, "date" | "time" | "quick">) => void; minDate?: string }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>Quando</Label>
        <div role="group" aria-label="Quando" className="flex flex-wrap gap-2">
          {QUICK_OPTIONS.map(({ kind, label }) => {
            const on = value.quick === kind
            return (
              <button key={kind} type="button" aria-pressed={on} data-quick={kind} onClick={() => onChange({ ...quickOption(kind, now), quick: kind })} className={cn(pillBase, on ? pillOn : pillOff)}>
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="rem-date">Data</Label>
          <DatePickerField id="rem-date" value={value.date} min={minDate} onChange={(date) => onChange({ date, time: value.time, quick: null })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rem-time">Hora</Label>
          <Input id="rem-time" type="time" step={300} value={value.time} onChange={(e) => onChange({ date: value.date, time: e.target.value, quick: null })} className={cn(fieldClass, "tabular")} />
        </div>
      </div>
    </>
  )
}

// ------------------------------------------------------------------ new / edit

/** "Novo lembrete" (or "Editar lembrete"): a dialog on desktop, a bottom sheet on phones. */
export function ReminderSheet({ draft, now, onClose, onSave }: { draft: ReminderDraft | null; now: Date; onClose: () => void; onSave: (draft: ReminderDraft) => void }) {
  return (
    <ResponsiveSheet open={Boolean(draft)} onOpenChange={(open) => !open && onClose()} title={draft?.id ? "Editar lembrete" : "Novo lembrete"} description="Escolha quando quer ser avisado.">
      {draft ? <ReminderForm draft={draft} now={now} onClose={onClose} onSave={onSave} /> : null}
    </ResponsiveSheet>
  )
}

function ReminderForm({ draft, now, onClose, onSave }: { draft: ReminderDraft; now: Date; onClose: () => void; onSave: (draft: ReminderDraft) => void }) {
  const [title, setTitle] = useState(draft.title)
  const [when, setWhen] = useState({ date: draft.date, time: draft.time, quick: draft.quick })
  const [repeat, setRepeat] = useState<RepeatRule>(draft.repeat)
  const [advance, setAdvance] = useState<AdvanceMinutes>(draft.advance)
  const valid = title.trim() !== "" && when.time !== ""

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave({ ...draft, title: title.trim(), ...when, repeat, advance })
        onClose()
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="rem-title">O que lembrar</Label>
        <Input id="rem-title" autoFocus value={title} maxLength={120} placeholder="Ex.: Pagar o boleto da internet" onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
      </div>
      <WhenFields now={now} value={when} onChange={setWhen} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="rem-repeat">Repetir</Label>
          <Select value={repeat} onValueChange={(v) => setRepeat(v as RepeatRule)}>
            <SelectTrigger id="rem-repeat" className="h-11 w-full rounded-[12px] data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPEAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rem-advance">Avisar</Label>
          <Select value={String(advance)} onValueChange={(v) => setAdvance(Number(v) as AdvanceMinutes)}>
            <SelectTrigger id="rem-advance" className="h-11 w-full rounded-[12px] data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADVANCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} className={LIMA_BUTTON}>
          {draft.id ? "Salvar" : "Criar lembrete"}
        </Button>
      </StickyFooter>
    </form>
  )
}

// ------------------------------------------------------------------ rescheduling

/** "Reagendar": the same quick options, a date and a time, applied to one reminder or to all the overdue ones. */
export function RescheduleSheet({ target, now, onClose, onApply }: { target: { count: number; title: string } | null; now: Date; onClose: () => void; onApply: (iso: string) => void }) {
  return (
    <ResponsiveSheet open={Boolean(target)} onOpenChange={(open) => !open && onClose()} title="Reagendar" description={target ? (target.count === 1 ? target.title : `${target.count} lembretes atrasados`) : undefined}>
      {target ? <RescheduleForm now={now} onClose={onClose} onApply={onApply} /> : null}
    </ResponsiveSheet>
  )
}

function RescheduleForm({ now, onClose, onApply }: { now: Date; onClose: () => void; onApply: (iso: string) => void }) {
  const first = quickOption("tomorrow", now)
  const [when, setWhen] = useState<Pick<ReminderDraft, "date" | "time" | "quick">>({ ...first, quick: "tomorrow" })
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!when.time) return
        onApply(draftInstant(when))
        onClose()
      }}
    >
      <WhenFields now={now} value={when} onChange={setWhen} />
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!when.time} className={LIMA_BUTTON}>
          Reagendar
        </Button>
      </StickyFooter>
    </form>
  )
}
