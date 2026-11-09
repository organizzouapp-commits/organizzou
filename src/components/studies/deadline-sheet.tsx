"use client"

import { useState } from "react"

import { DatePickerField } from "@/components/organizzou/date-picker-field"
import { SegmentedPills } from "@/components/finance/bento"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fieldClass, pillBase, pillOff, pillOn, StickyFooter } from "@/components/workouts/sheet-fields"
import { REMIND_OPTIONS, TYPE_LABELS, type DeadlineType } from "@/features/studies/deadlines"
import type { SubjectRow } from "@/features/studies/types"
import { cn } from "@/lib/utils"

export type DeadlineDraft = { id?: string; title: string; date: string; type: DeadlineType; subjectId: string; remind: number[] }

const NO_SUBJECT = "none"
const TYPES = (Object.keys(TYPE_LABELS) as DeadlineType[]).map((id) => ({ id, label: TYPE_LABELS[id] }))

/** "Nova prova ou prazo" (or "Editar prazo"): a dialog on desktop, a bottom sheet on phones. */
export function DeadlineSheet({ draft, today, subjects, onClose, onSave }: { draft: DeadlineDraft | null; today: string; subjects: SubjectRow[]; onClose: () => void; onSave: (draft: DeadlineDraft) => void }) {
  return (
    <ResponsiveSheet open={Boolean(draft)} onOpenChange={(open) => !open && onClose()} title={draft?.id ? "Editar prazo" : "Nova prova ou prazo"} description="Escolha o tipo e a data.">
      {draft ? <DeadlineForm draft={draft} today={today} subjects={subjects} onClose={onClose} onSave={onSave} /> : null}
    </ResponsiveSheet>
  )
}

function DeadlineForm({ draft, today, subjects, onClose, onSave }: { draft: DeadlineDraft; today: string; subjects: SubjectRow[]; onClose: () => void; onSave: (draft: DeadlineDraft) => void }) {
  const [title, setTitle] = useState(draft.title)
  const [date, setDate] = useState(draft.date)
  const [type, setType] = useState<DeadlineType>(draft.type)
  const [subjectId, setSubjectId] = useState(draft.subjectId || NO_SUBJECT)
  const [remind, setRemind] = useState<number[]>(draft.remind)
  const valid = title.trim() !== ""

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave({ id: draft.id, title: title.trim(), date, type, subjectId: subjectId === NO_SUBJECT ? "" : subjectId, remind })
        onClose()
      }}
    >
      <div className="flex flex-col gap-2">
        <Label>Tipo</Label>
        <SegmentedPills<DeadlineType> ariaLabel="Tipo" items={TYPES} value={type} onChange={setType} className="w-full [&>button]:flex-1" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="dl-title">Título</Label>
        <Input id="dl-title" autoFocus value={title} maxLength={100} placeholder="Ex.: Prova de Cálculo II" onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dl-date">Data</Label>
          <DatePickerField id="dl-date" value={date} onChange={setDate} min={draft.id ? undefined : today} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dl-subject">Matéria</Label>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger id="dl-subject" className="h-11 w-full rounded-[12px] data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SUBJECT}>Sem matéria</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Lembrar</Label>
        <div role="group" aria-label="Lembrar" className="flex flex-wrap gap-2">
          {REMIND_OPTIONS.map(({ days, label }) => {
            const on = remind.includes(days)
            return (
              <button key={days} type="button" aria-pressed={on} data-remind={days} onClick={() => setRemind(on ? remind.filter((d) => d !== days) : [...remind, days].sort((a, b) => a - b))} className={cn(pillBase, on ? pillOn : pillOff)}>
                {label}
              </button>
            )
          })}
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">Os lembretes ficam salvos no prazo; o aviso em si chega em breve.</p>
      </div>
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} className="bg-highlight text-highlight-foreground hover:bg-highlight/90">
          {draft.id ? "Salvar" : "Adicionar"}
        </Button>
      </StickyFooter>
    </form>
  )
}
