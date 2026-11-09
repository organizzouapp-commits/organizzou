"use client"

import { useState } from "react"

import { DatePickerField } from "@/components/organizzou/date-picker-field"
import { modules, type ModuleId } from "@/components/organizzou/modules"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { fieldClass, pillBase, pillOff, pillOn, StickyFooter } from "@/components/workouts/sheet-fields"
import { cn } from "@/lib/utils"

export const LINKABLE: ModuleId[] = ["tarefas", "rotina", "financas", "treinos", "dieta", "estudos"]

export type GoalDraft = { id?: string; title: string; description: string; deadline: string; modules: ModuleId[] }

/** "Nova meta" (or "Editar meta"): a dialog on desktop, a bottom sheet on phones. Which modules feed a goal is chosen when it is created. */
export function GoalSheet({ draft, today, onClose, onSave }: { draft: GoalDraft | null; today: string; onClose: () => void; onSave: (draft: GoalDraft) => void }) {
  return (
    <ResponsiveSheet open={Boolean(draft)} onOpenChange={(open) => !open && onClose()} title={draft?.id ? "Editar meta" : "Nova meta"} description="Defina o objetivo e de onde vem o progresso.">
      {draft ? <GoalForm draft={draft} today={today} onClose={onClose} onSave={onSave} /> : null}
    </ResponsiveSheet>
  )
}

function GoalForm({ draft, today, onClose, onSave }: { draft: GoalDraft; today: string; onClose: () => void; onSave: (draft: GoalDraft) => void }) {
  const [title, setTitle] = useState(draft.title)
  const [description, setDescription] = useState(draft.description)
  const [deadline, setDeadline] = useState(draft.deadline)
  const [linked, setLinked] = useState<ModuleId[]>(draft.modules)
  const valid = title.trim() !== ""

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave({ ...draft, title: title.trim(), description: description.trim(), deadline, modules: linked })
        onClose()
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="goal-title">Meta</Label>
        <Input id="goal-title" autoFocus value={title} maxLength={100} placeholder="Ex.: Aprender a tocar violão" onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="goal-desc">Descrição</Label>
        <Textarea id="goal-desc" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} className="min-h-20 rounded-[12px] px-3 py-2.5 text-[15px] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="goal-deadline">Prazo (opcional)</Label>
        <DatePickerField id="goal-deadline" value={deadline} onChange={setDeadline} onClear={() => setDeadline("")} min={draft.id ? undefined : today} placeholder="Sem prazo" />
      </div>
      {draft.id ? null : (
        <div className="flex flex-col gap-2">
          <Label>Alimentado por</Label>
          <div role="group" aria-label="Alimentado por" className="flex flex-wrap gap-2">
            {LINKABLE.map((module) => {
              const Icon = modules[module].icon
              const on = linked.includes(module)
              return (
                <button key={module} type="button" aria-pressed={on} data-module={module} onClick={() => setLinked(on ? linked.filter((m) => m !== module) : [...linked, module])} className={cn(pillBase, "gap-1.5", on ? pillOn : pillOff)}>
                  <Icon aria-hidden strokeWidth={1.75} className="size-4" /> {modules[module].name}
                </button>
              )
            })}
          </div>
          <p className="text-[13px] leading-5 text-muted-foreground">Sem módulo, você acompanha só pelos marcos.</p>
        </div>
      )}
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} className="bg-highlight text-highlight-foreground hover:bg-highlight/90">
          {draft.id ? "Salvar" : "Criar meta"}
        </Button>
      </StickyFooter>
    </form>
  )
}
