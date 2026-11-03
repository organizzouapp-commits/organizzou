"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AnnoyedIcon, ArrowUpRightIcon, CheckIcon, EllipsisIcon, FrownIcon, GlassWaterIcon, LaughIcon, MehIcon, PinIcon, PlusIcon, SmileIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { ModuleCard } from "@/components/organizzou/ModuleCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { panelMeta, type PanelId } from "@/features/today/catalog"
import type { DietData, FinanceData, NotesData, StudyData, WidgetState, WorkoutData } from "@/features/today/types"
import { MOOD_LABELS, type Mood } from "@/features/journal/types"
import { formatBRL } from "@/lib/money"
import { cn } from "@/lib/utils"

import { useModuleAccordion } from "./module-accordion"
import { useTodayState } from "./today-state"

const clock = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
const liters = (ml: number) => `${(ml / 1000).toLocaleString("pt-BR")} L`
/** "1h15", "3h09": no spaces, minutes always two digits. */
const compactHours = (minutes: number) => `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const overline = "text-[11px] leading-4 font-semibold tracking-[0.12em] uppercase text-muted-foreground"

/** The browser clock, refreshed every minute (null while rendering on the server, so the markup matches). */
function useNowMs() {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    // The clock only exists in the browser, so it cannot be read during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

/**
 * Every panel except "Seu dia", on phones and desktop alike: a ModuleCard whose header (icon, title, one-line subtitle, status on
 * the right, one chevron) is the only control, and whose body unfolds full-width. One card is open at a time (see
 * module-accordion.tsx); outside the page a card keeps its own state.
 */
export function PanelCard({
  id,
  subtitle,
  status,
  href,
  moduleName,
  state,
  needs,
  children,
}: {
  id: PanelId
  subtitle?: React.ReactNode
  status?: React.ReactNode
  href: string
  moduleName: string
  state: WidgetState
  needs: boolean
  children: React.ReactNode
}) {
  const meta = panelMeta(id)
  const accordion = useModuleAccordion()
  const [local, setLocal] = useState(false)
  const open = accordion ? accordion.openId === id : local
  return (
    <ModuleCard
      id={id}
      title={meta?.title ?? id}
      icon={meta?.icon as LucideIcon}
      subtitle={state === "soon" ? "Em breve" : subtitle}
      status={state === "soon" ? undefined : status}
      href={href}
      moduleName={moduleName}
      open={open}
      onToggle={() => (accordion ? accordion.toggle(id) : setLocal((v) => !v))}
      needs={needs}
    >
      {state === "soon" ? <p className="text-[15px] leading-6 text-muted-foreground">Este módulo ainda não tem dados reais. Em breve aparece aqui.</p> : children}
    </ModuleCard>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

export function FinancePanel({ data }: { data: FinanceData }) {
  const short = data.surplusCents < 0
  const amount = formatBRL(Math.abs(data.surplusCents))
  const label = short ? "Faltam no mês" : "Sobra do mês"
  return (
    <PanelCard
      id="financas"
      href="/dashboard/financas"
      moduleName="Finanças"
      state={data.state}
      needs={short}
      subtitle={`Orçamento ${data.budgetPct}%`}
      status={
        <>
          {short ? <TriangleAlertIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" /> : null}
          <span className="flex flex-col items-end">
            <span className="text-[12px] leading-4 text-muted-foreground">{label}</span>
            <span className="text-[15px] leading-5 font-semibold">{amount}</span>
          </span>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={overline}>{label}</span>
          <span className="tabular flex items-center gap-1.5 text-xl leading-7 font-semibold">
            <ArrowUpRightIcon aria-hidden strokeWidth={1.75} className={cn("size-5 shrink-0", short && "rotate-90")} />
            {amount}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className={overline}>Orçamento</span>
          <span className="tabular text-xl leading-7 font-semibold">{data.budgetPct}%</span>
        </div>
      </div>
      <Progress value={Math.min(100, data.budgetPct)} aria-label="Orçamento usado" className="w-full" />
      <p className="tabular text-[13px] leading-5 text-muted-foreground">{data.budgetLine}</p>
    </PanelCard>
  )
}

/** A 28 px ring (foreground arc on a muted track; `chart-1` is Lima in dark and Tinta verso in light, never a thin Lima line on Papel). */
function Ring({ value, label }: { value: number; label: string }) {
  const r = 11
  const c = 2 * Math.PI * r
  return (
    <svg role="img" aria-label={label} viewBox="0 0 28 28" className="size-7 shrink-0 -rotate-90">
      <circle cx="14" cy="14" r={r} fill="none" strokeWidth="3.5" className="stroke-muted" />
      <circle cx="14" cy="14" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))} className="stroke-chart-1" />
    </svg>
  )
}

export function DietPanel({ data }: { data: DietData }) {
  const { waterMl, addWater } = useTodayState()
  const water = data.waterMl + waterMl
  const kcal = `${data.kcal.toLocaleString("pt-BR")} de ${data.goalKcal.toLocaleString("pt-BR")} kcal`
  return (
    <PanelCard
      id="dieta"
      href="/dashboard/dieta"
      moduleName="Dieta"
      state={data.state}
      needs={data.kcal === 0}
      subtitle={`Água ${liters(water)}`}
      status={
        <>
          <span className="max-[390px]:sr-only">{kcal}</span>
          <Ring value={data.goalKcal === 0 ? 0 : data.kcal / data.goalKcal} label={`Calorias: ${kcal}`} />
        </>
      }
    >
      <div className="tabular flex min-w-0 justify-between gap-3 text-[15px] leading-6">
        <span>
          {data.kcal.toLocaleString("pt-BR")} <span className="text-muted-foreground">de {data.goalKcal.toLocaleString("pt-BR")} kcal</span>
        </span>
        <span className="text-muted-foreground">P {data.protein} g</span>
      </div>
      <Progress value={data.goalKcal === 0 ? 0 : Math.min(100, (data.kcal / data.goalKcal) * 100)} aria-label="Calorias do dia" className="w-full" />
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <span className="tabular text-[13px] leading-5 text-muted-foreground">{data.waterGoalMl > 0 ? `Água: ${liters(water)} de ${liters(data.waterGoalMl)}` : `Água: ${liters(water)}`}</span>
        <Button variant="outline" className="h-11 rounded-full px-4" onClick={() => addWater(250)}>
          <GlassWaterIcon strokeWidth={1.75} /> + 250 ml
        </Button>
      </div>
    </PanelCard>
  )
}

export function WorkoutPanel({ data }: { data: WorkoutData }) {
  const planned = Boolean(data.title)
  const short = data.title ? data.title.split(" — ")[0] : null
  return (
    <PanelCard
      id="treino"
      href="/dashboard/treinos"
      moduleName="Treinos"
      state={data.state}
      needs={planned && !data.doneToday}
      subtitle={short ? (data.time ? `${short} · hoje ${data.time}` : short) : "Dia de descanso"}
      status={planned ? <Badge variant="secondary">{data.doneToday ? "Feito" : "Pendente"}</Badge> : undefined}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 text-[15px] leading-6">{data.title ?? "Dia de descanso"}</span>
        {data.time ? (
          <Badge variant="secondary" className="flex-none whitespace-nowrap">
            {data.time}
          </Badge>
        ) : null}
      </div>
      {data.weekPlanned > 0 ? (
        <div className="flex min-w-0 flex-col gap-2">
          <span className="tabular text-[13px] leading-5 text-muted-foreground">
            {data.weekDone} de {data.weekPlanned} treinos na semana
          </span>
          <Progress value={Math.min(100, Math.round((data.weekDone / data.weekPlanned) * 100))} aria-label="Treinos da semana" className="w-full" />
        </div>
      ) : null}
    </PanelCard>
  )
}

export function StudyPanel({ data }: { data: StudyData }) {
  const pct = data.dailyGoalMin === 0 ? 0 : Math.min(100, Math.round((data.studiedMin / data.dailyGoalMin) * 100))
  const examWhen = data.exam ? (data.exam.days === 0 ? "hoje" : `em ${plural(data.exam.days, "dia", "dias")}`) : null
  return (
    <PanelCard
      id="estudos"
      href="/dashboard/estudos"
      moduleName="Estudos"
      state={data.state}
      needs={Boolean(data.exam && data.exam.days <= 14)}
      subtitle={data.exam ? `Prova ${examWhen}` : "Sem prova marcada"}
      status={
        <span className="flex w-28 flex-col items-end gap-1">
          <span className="text-[13px] leading-5 whitespace-nowrap">
            {compactHours(data.studiedMin)} de {compactHours(data.dailyGoalMin)}
          </span>
          <Progress value={pct} aria-label="Estudo de hoje" className="h-1 w-full" />
        </span>
      }
    >
      <Progress value={pct} aria-label="Estudo de hoje" className="w-full" />
      {data.exam ? (
        <div className="flex min-w-0 items-start justify-between gap-3">
          <p className="min-w-0 flex-1 text-[15px] leading-6 break-words">{data.exam.title}</p>
          <Badge variant="highlight" className="flex-none whitespace-nowrap">
            {examWhen}
          </Badge>
        </div>
      ) : null}
      <Button asChild variant="secondary" className="h-11 w-full rounded-xl">
        <Link href="/dashboard/estudos">
          {data.dueCards} {data.dueCards === 1 ? "cartão para revisar" : "cartões para revisar"}
        </Link>
      </Button>
    </PanelCard>
  )
}

const MOODS: { value: Mood; icon: LucideIcon }[] = [
  { value: 1, icon: FrownIcon },
  { value: 2, icon: AnnoyedIcon },
  { value: 3, icon: MehIcon },
  { value: 4, icon: SmileIcon },
  { value: 5, icon: LaughIcon },
]

/** "Como você está?": not a folding card, the five buttons are always there (a grid of 5 equal 44 px columns). */
export function MoodPanel({ data }: { data: { mood: number | null } }) {
  const { mood: picked, setMood } = useTodayState()
  const mood = (picked ?? data.mood) as Mood | null
  const meta = panelMeta("humor")
  const Icon = meta?.icon
  return (
    <section aria-label="Como você está?" data-module-card="humor" data-needs={data.mood === null ? "true" : "false"} className="flex min-w-0 flex-col gap-3 rounded-[16px] border border-foreground/6 bg-card p-4">
      <div className="flex min-h-9 items-center gap-3">
        {Icon ? <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" /> : null}
        <h2 className="min-w-0 flex-1 text-[17px] leading-6 font-semibold">Como você está?</h2>
        {mood ? (
          <span className="flex shrink-0 items-center gap-2 text-[13px] leading-5">
            <span data-testid="mood-label" className="text-muted-foreground">
              Hoje: {MOOD_LABELS[mood].toLowerCase()}
            </span>
            <Button type="button" variant="ghost" className="h-11 rounded-full px-3 text-[13px]" onClick={(event) => event.currentTarget.closest("section")?.querySelector<HTMLElement>("[role=radio]")?.focus()}>
              Editar
            </Button>
          </span>
        ) : null}
      </div>
      <div role="radiogroup" aria-label="Humor de hoje" className="grid grid-cols-5 gap-2">
        {MOODS.map(({ value, icon: MoodIcon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mood === value}
            aria-label={MOOD_LABELS[value]}
            title={MOOD_LABELS[value]}
            onClick={() => {
              setMood(value)
              toast.success(`Humor registrado: ${MOOD_LABELS[value].toLowerCase()}.`)
            }}
            className={cn(
              "flex h-11 min-w-0 items-center justify-center rounded-xl border border-border outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              mood === value && "border-transparent bg-highlight text-highlight-foreground hover:bg-highlight"
            )}
          >
            <MoodIcon aria-hidden strokeWidth={1.75} className="size-6" />
          </button>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

type Reminder = NotesData["reminders"][number]

/** "14:30", or "Em 20 min" when it is less than an hour away. */
function nextReminderText(reminder: Reminder | undefined, nowMs: number | null) {
  if (!reminder) return undefined
  if (nowMs === null) return clock(reminder.at)
  const minutes = Math.round((new Date(reminder.at).getTime() - nowMs) / 60_000)
  return minutes >= 0 && minutes < 60 ? (minutes === 0 ? "Agora" : `Em ${minutes} min`) : clock(reminder.at)
}

/**
 * Open: up to 2 of today's reminders (time, title that wraps, "Feito" / "Adiar" in a ⋯ menu), up to 2 pinned notes, a one-line quick
 * note. Reminders are listed but not delivered yet (docs/INTEGRATIONS-STATUS.md).
 */
export function NotesPanel({ data }: { data: NotesData }) {
  const [reminders, setReminders] = useState<Reminder[]>(data.reminders)
  const [quick, setQuick] = useState<{ id: string; title: string }[]>([])
  const [draft, setDraft] = useState("")
  const nowMs = useNowMs()
  const pinnedCount = data.pinned.length + quick.length

  function finish(reminder: Reminder) {
    setReminders((list) => list.filter((r) => r.id !== reminder.id))
    toast("Lembrete concluído.", { action: { label: "Desfazer", onClick: () => setReminders((list) => [...list, reminder].sort((a, b) => a.at.localeCompare(b.at))) } })
  }

  function snooze(reminder: Reminder, minutes: number, label: string) {
    const next = { ...reminder, at: new Date(new Date(reminder.at).getTime() + minutes * 60_000).toISOString() }
    setReminders((list) => list.map((r) => (r.id === reminder.id ? next : r)).sort((a, b) => a.at.localeCompare(b.at)))
    toast(`Lembrete adiado ${label}.`, { action: { label: "Desfazer", onClick: () => setReminders((list) => list.map((r) => (r.id === reminder.id ? reminder : r)).sort((a, b) => a.at.localeCompare(b.at))) } })
  }

  function createQuick() {
    const title = draft.trim()
    if (!title) return
    setQuick((list) => [{ id: `quick-${Date.now()}`, title }, ...list])
    setDraft("")
    toast.success("Nota criada.")
  }

  const summary = `${plural(reminders.length, "lembrete", "lembretes")} hoje · ${plural(pinnedCount, "fixada", "fixadas")}`

  return (
    <PanelCard id="notas" href="/dashboard/notas" moduleName="Notas e lembretes" state={data.state} needs={data.reminders.length > 0} subtitle={summary} status={nextReminderText(reminders[0], nowMs)}>
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className={overline}>Lembretes de hoje</h3>
        {reminders.length === 0 ? (
          <p className="text-[15px] leading-6 text-muted-foreground">Nenhum lembrete para o resto do dia.</p>
        ) : (
          <ul className="min-w-0">
            {reminders.slice(0, 2).map((reminder) => (
              <li key={reminder.id} className="flex min-h-11 items-center gap-3 border-b border-border py-1 last:border-b-0">
                <span className="tabular w-11 shrink-0 text-[13px] leading-5 text-muted-foreground">{clock(reminder.at)}</span>
                <span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-5 break-words">{reminder.title}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" aria-label={`Ações do lembrete: ${reminder.title}`}>
                      <EllipsisIcon strokeWidth={1.75} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" collisionPadding={{ top: 16, bottom: 104, left: 16, right: 16 }} className="min-w-48 rounded-2xl p-2">
                    <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => finish(reminder)}>
                      <CheckIcon strokeWidth={1.75} /> Feito
                    </DropdownMenuItem>
                    <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => snooze(reminder, 60, "em 1 hora")}>
                      Adiar 1 hora
                    </DropdownMenuItem>
                    <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => snooze(reminder, 24 * 60, "para amanhã")}>
                      Adiar para amanhã
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pinnedCount > 0 ? (
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className={overline}>Notas fixadas</h3>
          <ul className="min-w-0">
            {quick.slice(0, 2).map((note) => (
              <li key={note.id} className="border-b border-border last:border-b-0">
                <Link href="/dashboard/notas" className="flex min-h-11 flex-col justify-center rounded-md py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <span className="text-[15px] leading-5 font-medium break-words">{note.title}</span>
                  <span className="truncate text-[13px] leading-5 text-muted-foreground">Nota rápida · só nesta visita (as notas ainda são simuladas)</span>
                </Link>
              </li>
            ))}
            {data.pinned.slice(0, Math.max(0, 2 - quick.length)).map((note) => (
              <li key={note.id} className="border-b border-border last:border-b-0">
                <Link href="/dashboard/notas" className="flex min-h-11 flex-col justify-center rounded-md py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <span className="flex items-center gap-1.5 text-[15px] leading-5 font-medium">
                    <PinIcon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate">{note.title}</span>
                  </span>
                  <span className="truncate text-[13px] leading-5 text-muted-foreground">{note.preview}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className="flex min-w-0 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          createQuick()
        }}
      >
        <label className="sr-only" htmlFor="quick-note">
          Nota rápida
        </label>
        <Input id="quick-note" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Nota rápida" autoComplete="off" enterKeyHint="done" className="h-11 min-w-0 flex-1 rounded-xl bg-card px-4 text-[15px]" />
        <Button type="submit" variant="outline" size="icon" className="size-11 shrink-0 rounded-xl" aria-label="Criar nota rápida" disabled={!draft.trim()}>
          <PlusIcon strokeWidth={1.75} />
        </Button>
      </form>
    </PanelCard>
  )
}
