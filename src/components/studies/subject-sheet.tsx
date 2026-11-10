"use client"

import { useState } from "react"

import { SwatchPicker } from "@/components/organizzou/SwatchPicker"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DecimalStepper, fieldClass, StickyFooter } from "@/components/workouts/sheet-fields"
import { MAX_GOAL_HOURS, goalHoursText, weeklyGoalMinutes } from "@/features/studies/subject-form"
import { PRIORITY_LABELS, SUBJECT_TYPE_LABELS, type Priority, type SubjectRow, type SubjectType } from "@/features/studies/types"
import type { SwatchId } from "@/lib/swatches"
import { newId } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

const LIMA_BUTTON = "bg-highlight text-highlight-foreground hover:bg-highlight/90"

/** "Nova matéria" / "Editar matéria": one sheet for both (a dialog on desktop, a bottom sheet on phones). `subject` null creates. */
export function SubjectSheet({ open, subject, nowIso, userId, onSave, onClose }: { open: boolean; subject: SubjectRow | null; nowIso: string; userId: string; onSave: (subject: SubjectRow) => void; onClose: () => void }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={(o) => !o && onClose()} title={subject ? "Editar matéria" : "Nova matéria"} description="Cadastre o que você estuda, com uma meta semanal.">
      {open ? <SubjectForm key={subject?.id ?? "new"} subject={subject} nowIso={nowIso} userId={userId} onSave={onSave} onClose={onClose} /> : null}
    </ResponsiveSheet>
  )
}

function SubjectForm({ subject, nowIso, userId, onSave, onClose }: { subject: SubjectRow | null; nowIso: string; userId: string; onSave: (subject: SubjectRow) => void; onClose: () => void }) {
  const [name, setName] = useState(subject?.name ?? "")
  const [type, setType] = useState<SubjectType>(subject?.type ?? "subject")
  const [priority, setPriority] = useState<Priority>(subject?.priority ?? "medium")
  const [goal, setGoal] = useState(subject ? goalHoursText(subject.weekly_goal_min) : "4")
  const [swatch, setSwatch] = useState<SwatchId>(subject?.swatch ?? "neutro")
  const minutes = weeklyGoalMinutes(goal)
  const valid = name.trim() !== "" && minutes !== null

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || minutes === null) return
        const trackedProgress = type === "course" || type === "book" || type === "exam"
        onSave(
          subject
            ? { ...subject, name: name.trim(), type, priority, swatch, weekly_goal_min: minutes, progress_pct: trackedProgress ? (subject.progress_pct ?? 0) : null, updated_at: nowIso }
            : { id: newId(), user_id: userId, name: name.trim(), type, priority, swatch, weekly_goal_min: minutes, progress_pct: trackedProgress ? 0 : null, progress_label: null, created_at: nowIso, updated_at: nowIso }
        )
        onClose()
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="sub-name">Nome</Label>
        <Input id="sub-name" autoFocus value={name} maxLength={80} placeholder="Ex.: Direito Administrativo" autoComplete="off" onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sub-type">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as SubjectType)}>
            <SelectTrigger id="sub-type" className={cn(fieldClass, "w-full")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SUBJECT_TYPE_LABELS) as SubjectType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {SUBJECT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sub-priority">Prioridade</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger id="sub-priority" className={cn(fieldClass, "w-full")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sub-goal">Meta semanal (horas)</Label>
        <DecimalStepper id="sub-goal" label="Meta semanal" value={goal} onChange={setGoal} step={0.5} min={0} max={MAX_GOAL_HOURS} decimals={1} unit="h" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Cor</Label>
        <SwatchPicker value={swatch} onChange={setSwatch} large />
      </div>
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} className={LIMA_BUTTON}>
          {subject ? "Salvar" : "Criar matéria"}
        </Button>
      </StickyFooter>
    </form>
  )
}
