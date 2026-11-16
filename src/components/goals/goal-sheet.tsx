"use client"

import { useMemo, useState } from "react"
import { ArrowLeftIcon, FlagIcon, type LucideIcon } from "lucide-react"

import { CurrencyInput } from "@/components/organizzou/currency-input"
import { DatePickerField } from "@/components/organizzou/date-picker-field"
import { modules } from "@/components/organizzou/modules"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { fieldClass, StickyFooter } from "@/components/workouts/sheet-fields"
import { blankFields, buildLink, fieldsOf, SUBS, validateDates, type Built, type Fields, type Group } from "@/features/goals/link-form"
import type { GoalSources, LinkSpec } from "@/features/goals/linked"
import { newId } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

export type GoalDraft = {
  id?: string
  title: string
  description: string
  /** The end date (the deadline); empty = no deadline. */
  deadline: string
  startDate: string
  /** The link the goal already has (editing). */
  link?: LinkSpec | null
}

export type GoalSave = { id?: string; title: string; description: string; deadline: string; startDate: string; built: Built | null }

const GROUPS: { id: Group; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "finance", label: "Finanças", hint: "Meta de economia ou limite de gasto", icon: modules.financas.icon },
  { id: "habit", label: "Hábitos", hint: "Dias seguidos, % do mês ou vezes por semana", icon: modules.rotina.icon },
  { id: "study", label: "Estudos", hint: "Horas de estudo ou flashcards revisados", icon: modules.estudos.icon },
  { id: "workout", label: "Treinos", hint: "Treinos por semana ou um recorde", icon: modules.treinos.icon },
  { id: "diet", label: "Dieta e peso", hint: "Peso alvo ou dias na meta de calorias", icon: modules.dieta.icon },
  { id: "tasks", label: "Tarefas", hint: "Concluir as tarefas de um quadro, lista ou etiqueta", icon: modules.tarefas.icon },
  { id: "free", label: "Livre", hint: "Você acompanha pelos marcos", icon: FlagIcon },
]

const select = cn(fieldClass, "w-full appearance-none bg-transparent")

/** "Nova meta": step 1 picks what drives it (a module or nothing), step 2 the details. A dialog on desktop, a bottom sheet on phones. */
export function GoalSheet({ draft, today, sources, onClose, onSave }: { draft: GoalDraft | null; today: string; sources: GoalSources; onClose: () => void; onSave: (save: GoalSave) => void }) {
  return (
    <ResponsiveSheet open={Boolean(draft)} onOpenChange={(open) => !open && onClose()} title={draft?.id ? "Editar meta" : "Nova meta"} description="Escolha de onde vem o progresso e defina o objetivo.">
      {draft ? <GoalForm key={draft.id ?? "new"} draft={draft} today={today} sources={sources} onClose={onClose} onSave={onSave} /> : null}
    </ResponsiveSheet>
  )
}

function Select({ id, value, onChange, children, label }: { id: string; value: string; onChange: (value: string) => void; children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={select}>
        {children}
      </select>
    </div>
  )
}

/** The part of step 2 that depends on the type. */
function TypeFields({ group, fields, set, sources }: { group: Group; fields: Fields; set: (patch: Partial<Fields>) => void; sources: GoalSources }) {
  const subs = group === "free" ? [] : SUBS[group]
  const subPicker =
    subs.length > 1 ? (
      <Select id="goal-sub" label="O que acompanhar" value={fields.sub} onChange={(sub) => set({ sub, refId: "" })}>
        {subs.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </Select>
    ) : null
  const period = (
    <Select id="goal-period" label="Período" value={fields.period} onChange={(period) => set({ period: period as Fields["period"] })}>
      <option value="week">Por semana</option>
      <option value="month">Por mês</option>
    </Select>
  )
  const number = (label: string, placeholder?: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="goal-amount">{label}</Label>
      <Input id="goal-amount" inputMode="decimal" value={fields.amount} placeholder={placeholder} onChange={(e) => set({ amount: e.target.value })} className={fieldClass} />
    </div>
  )
  const options = (rows: { id: string; name: string }[], empty: string) => (
    <>
      <option value="">{empty}</option>
      {rows.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </>
  )

  switch (group) {
    case "finance":
      return (
        <>
          {subPicker}
          {fields.sub === "existing" ? (
            <Select id="goal-ref" label="Meta de economia" value={fields.refId} onChange={(refId) => set({ refId })}>
              {options(sources.financeGoals, sources.financeGoals.length ? "Escolha uma meta" : "Você ainda não tem metas em Finanças")}
            </Select>
          ) : null}
          {fields.sub === "new" ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="goal-fin-name">Nome da meta de economia</Label>
                <Input id="goal-fin-name" value={fields.name} maxLength={80} placeholder="Igual ao nome da meta" onChange={(e) => set({ name: e.target.value })} className={fieldClass} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="goal-cents">Valor a guardar</Label>
                <CurrencyInput id="goal-cents" value={fields.cents} onValueChange={(cents) => set({ cents })} className={fieldClass} />
                <p className="text-[13px] leading-5 text-muted-foreground">Ela também aparece em Finanças &gt; Metas: é um registro só.</p>
              </div>
            </>
          ) : null}
          {fields.sub === "limit" ? (
            <>
              <Select id="goal-ref" label="Categoria" value={fields.refId} onChange={(refId) => set({ refId })}>
                {options(sources.categories, "Escolha uma categoria")}
              </Select>
              <div className="flex flex-col gap-2">
                <Label htmlFor="goal-cents">Limite por mês</Label>
                <CurrencyInput id="goal-cents" value={fields.cents} onValueChange={(cents) => set({ cents })} className={fieldClass} />
              </div>
            </>
          ) : null}
        </>
      )
    case "habit":
      return (
        <>
          <Select id="goal-ref" label="Hábito" value={fields.refId} onChange={(refId) => set({ refId })}>
            {options(sources.habits.filter((h) => !h.paused), sources.habits.length ? "Escolha um hábito" : "Crie um hábito em Rotina primeiro")}
          </Select>
          <Select id="goal-mode" label="Meta" value={fields.mode} onChange={(mode) => set({ mode: mode as Fields["mode"] })}>
            <option value="streak">Dias seguidos</option>
            <option value="month_pct">% de conclusão no mês</option>
            <option value="week_times">Vezes por semana</option>
          </Select>
          {number(fields.mode === "streak" ? "Quantos dias seguidos" : fields.mode === "month_pct" ? "Quantos % (até 100)" : "Quantas vezes por semana (até 7)")}
        </>
      )
    case "study":
      return (
        <>
          {subPicker}
          {fields.sub === "hours" ? (
            <Select id="goal-ref" label="Matéria" value={fields.refId} onChange={(refId) => set({ refId })}>
              {options(sources.subjects, "Todas as matérias")}
            </Select>
          ) : null}
          {period}
          {number(fields.sub === "hours" ? "Horas de estudo" : "Cartões revisados")}
        </>
      )
    case "workout":
      return (
        <>
          {subPicker}
          {fields.sub === "count" ? (
            <>
              {period}
              {number("Quantos treinos")}
            </>
          ) : (
            <>
              <Select id="goal-ref" label="Exercício" value={fields.refId} onChange={(refId) => set({ refId })}>
                {options(sources.exercises, "Escolha um exercício")}
              </Select>
              {number("Carga alvo (kg)")}
            </>
          )}
        </>
      )
    case "diet": {
      const latest = [...sources.weights].sort((a, b) => a.log_date.localeCompare(b.log_date)).at(-1)?.weight_kg
      return (
        <>
          {subPicker}
          {fields.sub === "weight" ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="goal-start-kg">Peso atual (kg)</Label>
                <Input id="goal-start-kg" inputMode="decimal" value={fields.startKg || (latest ? String(latest).replace(".", ",") : "")} onChange={(e) => set({ startKg: e.target.value })} className={fieldClass} />
              </div>
              {number("Peso alvo (kg)")}
            </>
          ) : (
            number("Dias por semana (até 7)")
          )}
        </>
      )
    }
    case "tasks":
      return (
        <>
          {subPicker}
          <Select id="goal-ref" label={fields.sub === "board" ? "Quadro" : fields.sub === "list" ? "Lista" : "Etiqueta"} value={fields.refId} onChange={(refId) => set({ refId })}>
            {options(fields.sub === "board" ? sources.boards : fields.sub === "list" ? sources.lists : sources.tags, "Escolha")}
          </Select>
        </>
      )
    default:
      return <p className="text-[13px] leading-5 text-muted-foreground">Sem módulo: você acompanha pelos marcos.</p>
  }
}

function GoalForm({ draft, today, sources, onClose, onSave }: { draft: GoalDraft; today: string; sources: GoalSources; onClose: () => void; onSave: (save: GoalSave) => void }) {
  const editing = Boolean(draft.id)
  const initial = useMemo(() => (draft.link ? fieldsOf(draft.link) : null), [draft.link])
  const [group, setGroup] = useState<Group | null>(editing ? (initial?.group ?? "free") : null)
  const [fields, setFields] = useState<Fields>(initial?.fields ?? blankFields("free"))
  const [title, setTitle] = useState(draft.title)
  const [description, setDescription] = useState(draft.description)
  const [startDate, setStartDate] = useState(draft.startDate)
  const [deadline, setDeadline] = useState(draft.deadline)
  const [tried, setTried] = useState(false)
  const [newFinanceId] = useState(() => newId())
  const set = (patch: Partial<Fields>) => setFields((current) => ({ ...current, ...patch }))

  if (group === null) {
    return (
      <div className="flex flex-col gap-2 pb-1" data-testid="goal-types" role="group" aria-label="Tipo de meta">
        <p className="text-[13px] leading-5 text-muted-foreground">O que alimenta essa meta?</p>
        {GROUPS.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            type="button"
            data-goal-type={id}
            onClick={() => {
              setGroup(id)
              setFields(blankFields(id))
            }}
            className="flex min-h-14 w-full items-center gap-3 rounded-[16px] border border-border px-3 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border">
              <Icon strokeWidth={1.75} className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] leading-5 font-semibold">{label}</span>
              <span className="text-[13px] leading-5 text-muted-foreground">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    )
  }

  const built = buildLink(group, fields, title.trim(), newFinanceId)
  const dates = validateDates(startDate, deadline)
  const linkMissing = group !== "free" && built === null
  const valid = title.trim() !== "" && !dates.start && !dates.end && !linkMissing

  return (
    <form
      className="flex flex-col gap-5"
      data-testid="goal-details"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (!valid) return
        onSave({ id: draft.id, title: title.trim(), description: description.trim(), deadline, startDate, built })
        onClose()
      }}
    >
      {editing ? null : (
        <button type="button" onClick={() => setGroup(null)} className="-mt-1 flex min-h-11 w-fit items-center gap-2 rounded-full pr-3 text-[14px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
          <ArrowLeftIcon aria-hidden strokeWidth={1.75} className="size-4" /> {GROUPS.find((g) => g.id === group)?.label}: trocar o tipo
        </button>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="goal-title">Meta</Label>
        <Input id="goal-title" autoFocus value={title} maxLength={100} placeholder="Ex.: Ler 20 minutos por dia" onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
      </div>
      <TypeFields group={group} fields={fields} set={set} sources={sources} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="goal-desc">Descrição</Label>
        <Textarea id="goal-desc" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} className="min-h-20 rounded-[12px] px-3 py-2.5 text-[15px] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="goal-start">Início</Label>
          <DatePickerField id="goal-start" value={startDate} onChange={setStartDate} placeholder="Hoje" />
          {tried && dates.start ? <p className="text-[13px] leading-5">{dates.start}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="goal-deadline">Prazo final (opcional)</Label>
          <DatePickerField id="goal-deadline" value={deadline} onChange={setDeadline} onClear={() => setDeadline("")} min={startDate || today} placeholder="Sem prazo" />
          {(tried || deadline) && dates.end ? <p className="text-[13px] leading-5">{dates.end}</p> : null}
        </div>
      </div>
      {tried && linkMissing ? <p className="text-[13px] leading-5">Preencha o que a meta acompanha.</p> : null}
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-highlight text-highlight-foreground hover:bg-highlight/90">
          {editing ? "Salvar" : "Criar meta"}
        </Button>
      </StickyFooter>
    </form>
  )
}
