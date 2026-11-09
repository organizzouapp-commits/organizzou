"use client"

import { format } from "date-fns"
import { CheckIcon, ChevronDownIcon, ClockIcon, DumbbellIcon, FootprintsIcon, HeartPulseIcon, ListChecksIcon, PlusIcon, TargetIcon, TimerIcon, WeightIcon, type LucideIcon } from "lucide-react"

import { BentoStat } from "@/components/finance/bento"
import { AddPill, HatchedProgress, HeroCard } from "@/components/finance/parts"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { clock, formatVolume, restLabel, type SetDraft } from "@/features/workouts/session"
import type { SetLogRow } from "@/features/workouts/types"
import { cn } from "@/lib/utils"

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

// ------------------------------------------------------------------ week strip

export type WeekDay = { key: string; date: Date; letter: string | null; planName: string | null; done: boolean; today: boolean }

/** The week as one summary card: SEG..DOM, the date and the letter of the workout planned for that weekday (or "descanso"). */
export function WeekStripCard({ days, selected, onSelect, isMobile }: { days: WeekDay[]; selected: string; onSelect: (key: string) => void; isMobile: boolean }) {
  return (
    <section aria-label="Semana" data-testid="week-strip" className="rounded-[20px] border border-border bg-card p-3 md:p-4">
      <div className="grid grid-cols-7 gap-1.5 md:gap-2" role="group" aria-label="Escolher o dia da semana">
        {days.map((day) => {
          const on = day.key === selected
          const label = `${WEEKDAY_SHORT[day.date.getDay()]}, ${format(day.date, "d")}: ${day.planName ? `${day.planName}${day.done ? ", treino feito" : ""}` : "descanso"}${day.today ? " (hoje)" : ""}`
          return (
            <button
              key={day.key}
              type="button"
              data-day={day.key}
              data-today={day.today}
              aria-pressed={on}
              aria-label={label}
              onClick={() => onSelect(day.key)}
              className={cn(
                "relative flex h-[84px] min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] px-0.5 outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:h-24",
                day.today ? "bg-highlight text-highlight-foreground" : "bg-muted/50 hover:bg-muted",
                on && "ring-2 ring-foreground ring-offset-2 ring-offset-card"
              )}
            >
              <span aria-hidden className={cn("text-[11px] leading-4 font-semibold tracking-[0.08em] uppercase", !day.today && "text-muted-foreground")}>
                {WEEKDAY_SHORT[day.date.getDay()]}
              </span>
              <span aria-hidden className="tabular text-[16px] leading-6 font-semibold">
                {format(day.date, "d")}
              </span>
              {day.letter ? (
                <span aria-hidden className={cn("flex size-6 items-center justify-center rounded-full text-[12px] leading-4 font-bold", day.today ? "bg-highlight-foreground text-highlight" : "bg-foreground/10")}>
                  {day.done ? <CheckIcon strokeWidth={2.5} className="size-3.5" /> : day.letter}
                </span>
              ) : (
                <span aria-hidden className={cn("text-[11px] leading-6", day.today ? "text-highlight-foreground/75" : "text-muted-foreground")}>
                  {isMobile ? "–" : "descanso"}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ summary row

export type PlanChoice = { id: string; letter: string; name: string }

export function SummaryRow({
  isMobile,
  today,
  letter,
  name,
  exercises,
  totalSets,
  doneSets,
  estimate,
  volume,
  lastTime,
  elapsed,
  plans,
  activeId,
  onPick,
}: {
  isMobile: boolean
  today: boolean
  letter: string
  name: string
  exercises: number
  totalSets: number
  doneSets: number
  estimate: number
  volume: number
  lastTime: number | null
  elapsed: number | null
  plans: PlanChoice[]
  activeId: string
  onPick: (id: string) => void
}) {
  const pct = totalSets === 0 ? 0 : Math.round((doneSets / totalSets) * 100)
  const dim = (text: string) => <span className="opacity-50">{text}</span>
  const hero = (
    <HeroCard
      className={isMobile ? undefined : "h-[216px]"}
      density={isMobile ? "default" : "dense"}
      label={`${today ? "Treino de hoje" : "Treino do dia"}${letter ? ` · ${letter}` : ""}`}
      value={<span className="block max-w-full truncate">{name}</span>}
      support={`${exercises} ${exercises === 1 ? "exercício" : "exercícios"} · ${totalSets} ${totalSets === 1 ? "série" : "séries"} · ~${estimate} min`}
      progress={{ value: pct, label: "Séries feitas" }}
      actions={
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" data-testid="swap-plan" className="relative inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-highlight-foreground/40 px-3 text-[13px] leading-5 font-medium outline-none transition-colors duration-[400ms] after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-highlight-foreground/10 focus-visible:ring-3 focus-visible:ring-highlight-foreground/40 motion-reduce:transition-none">
            Trocar treino
            <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          {plans.map((plan) => (
            <DropdownMenuItem key={plan.id} onSelect={() => onPick(plan.id)}>
              <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                {plan.letter}
              </span>
              <span className="min-w-0 flex-1 truncate">{plan.name}</span>
              {plan.id === activeId ? <CheckIcon aria-hidden strokeWidth={1.75} /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      }
    />
  )
  const cls = isMobile ? undefined : "h-[216px]"
  const tiles = [
    <BentoStat key="sets" compact={isMobile} className={cls} label="Séries" icon={ListChecksIcon} chip={isMobile ? `${pct}%` : `${pct}% do treino`}>
      {doneSets}
      {dim(`/${totalSets}`)}
    </BentoStat>,
    <BentoStat key="volume" compact={isMobile} className={cls} label="Volume" icon={WeightIcon} chip={lastTime === null ? "1ª vez" : isMobile ? `ant. ${formatVolume(lastTime)}` : `última vez: ${formatVolume(lastTime)}`}>
      {formatVolume(volume)}
    </BentoStat>,
    <BentoStat key="time" compact={isMobile} className={cls} label="Tempo" icon={TimerIcon} chip={isMobile ? `~${estimate} min` : `estimado: ${estimate} min`}>
      {elapsed === null ? dim("00:00") : clock(elapsed)}
    </BentoStat>,
  ]
  if (isMobile) {
    return (
      <div className="flex flex-col gap-3" data-testid="summary-row">
        {hero}
        <div className="grid grid-cols-3 gap-2">{tiles}</div>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-12 gap-4" data-testid="summary-row">
      <div className="col-span-5 flex min-w-0 flex-col [&>*]:flex-1">{hero}</div>
      <div className="col-span-7 grid min-w-0 grid-cols-3 gap-4">{tiles}</div>
    </div>
  )
}

// ------------------------------------------------------------------ exercise cards

export function exerciseIcon(name: string, group: string): LucideIcon {
  const text = `${name} ${group}`.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  if (/(cardio|corrida|esteira|bike|bicicleta|caminhad)/.test(text)) return group.toLowerCase().includes("cardio") ? HeartPulseIcon : FootprintsIcon
  if (/(abdom|core|prancha|lombar)/.test(text)) return TargetIcon
  return DumbbellIcon
}

const SET_GRID = "grid grid-cols-[28px_minmax(0,1fr)_72px_64px_44px] items-center gap-x-2 md:grid-cols-[28px_minmax(0,1fr)_80px_72px_44px]"

export function ExerciseCard({
  name,
  icon: Icon,
  setsCount,
  reps,
  restSeconds,
  drafts,
  previous,
  open,
  onToggle,
  next,
  onChange,
  onAddSet,
  onSwap,
}: {
  name: string
  icon: LucideIcon
  setsCount: number
  reps: number
  restSeconds: number
  drafts: SetDraft[]
  previous: (index: number) => Pick<SetLogRow, "load_kg" | "reps"> | undefined
  open: boolean
  onToggle: () => void
  /** The index of the next pending set of THIS card when it is the next one of the whole workout. */
  next: number | null
  onChange: (index: number, patch: Partial<SetDraft>) => void
  onAddSet: () => void
  onSwap: () => void
}) {
  const done = drafts.filter((d) => d.done).length
  const complete = drafts.length > 0 && done === drafts.length
  return (
    <section data-exercise={name} data-complete={complete} aria-label={name} className="min-w-0 rounded-[14px] border border-border bg-card">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-[60px] w-full items-center gap-3 rounded-[14px] p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border">
          <Icon strokeWidth={1.75} className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-5 font-semibold">{name}</span>
          <span className="tabular flex items-center gap-1 text-[13px] leading-5 text-muted-foreground">
            <ClockIcon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
            <span className="truncate">
              {setsCount} × {reps} · descanso {restLabel(restSeconds)}
            </span>
          </span>
        </span>
        {complete ? (
          <span data-chip="done" className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-highlight px-2 text-[12px] leading-4 font-semibold text-highlight-foreground">
            <CheckIcon aria-hidden strokeWidth={2.25} className="size-3.5" /> Feito
          </span>
        ) : (
          <span data-chip className="tabular inline-flex h-6 shrink-0 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 text-muted-foreground">
            {done}/{drafts.length}
          </span>
        )}
        <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-[400ms] motion-reduce:transition-none", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="flex flex-col gap-1 px-3 pb-3">
          <div aria-hidden className={cn(SET_GRID, "pb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase")}>
            <span />
            <span>Anterior</span>
            <span className="text-center">kg</span>
            <span className="text-center">reps</span>
            <span />
          </div>
          {drafts.map((draft, index) => {
            const prev = previous(index + 1)
            const isNext = next === index
            return (
              <div key={index} data-set={index + 1} data-done={draft.done} data-next={isNext} className={cn(SET_GRID, "min-h-[52px] rounded-[12px] px-0 transition-colors duration-[400ms] motion-reduce:transition-none md:min-h-12", isNext && "bg-foreground/5")}>
                <span aria-hidden className={cn("tabular flex size-7 items-center justify-center rounded-full text-[12px] leading-4 font-semibold", draft.done ? "bg-primary text-primary-foreground" : "border border-foreground/25")}>
                  {index + 1}
                </span>
                <span className="tabular truncate pl-1 text-[13px] leading-5 text-muted-foreground">{prev ? `${prev.load_kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} × ${prev.reps}` : "—"}</span>
                <Input
                  aria-label={`Carga da série ${index + 1} de ${name}`}
                  inputMode="decimal"
                  placeholder="kg"
                  value={draft.load}
                  onChange={(e) => onChange(index, { load: e.target.value })}
                  className={cn("tabular h-10 rounded-[12px] px-1 text-center md:h-9", draft.done && "border-primary/40 bg-primary/12 text-primary")}
                />
                <Input
                  aria-label={`Repetições da série ${index + 1} de ${name}`}
                  inputMode="numeric"
                  placeholder="reps"
                  value={draft.reps}
                  onChange={(e) => onChange(index, { reps: e.target.value })}
                  className={cn("tabular h-10 rounded-[12px] px-1 text-center md:h-9", draft.done && "border-primary/40 bg-primary/12 text-primary")}
                />
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={draft.done}
                  aria-label={`Série ${index + 1} de ${name} feita`}
                  onClick={() => onChange(index, { done: !draft.done })}
                  className="relative mx-auto flex size-8 items-center justify-center rounded-full outline-none after:absolute after:-inset-1.5 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className={cn("flex size-8 items-center justify-center rounded-full border-2 transition-colors duration-[400ms] motion-reduce:transition-none", draft.done ? "border-transparent bg-primary text-primary-foreground" : isNext ? "border-primary" : "border-foreground/30")}>
                    {draft.done ? <CheckIcon aria-hidden strokeWidth={2.5} className="size-4" /> : null}
                  </span>
                </button>
              </div>
            )
          })}
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" className="h-9 rounded-full px-4" onClick={onAddSet}>
              <PlusIcon strokeWidth={1.75} /> Série
            </Button>
            <Button variant="ghost" className="h-9 rounded-full px-3 text-muted-foreground" onClick={onSwap}>
              Substituir
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function AddExerciseRow({ onClick }: { onClick: () => void }) {
  return <AddPill label="Adicionar exercício…" onClick={onClick} />
}

// ------------------------------------------------------------------ sticky action bar

export type RestState = { remaining: number; total: number; label: string }

function RestRing({ rest }: { rest: RestState | null }) {
  const R = 17
  const C = 2 * Math.PI * R
  const progress = rest && rest.total > 0 ? rest.remaining / rest.total : 0
  return (
    <span aria-hidden className="relative flex size-10 shrink-0 items-center justify-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={R} fill="none" strokeWidth="3" className="stroke-foreground/15" />
        <circle cx="20" cy="20" r={R} fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none" />
      </svg>
      <TimerIcon strokeWidth={1.75} className="size-[18px]" />
    </span>
  )
}

/** The bar that stays in view: rest timer on the left, progress and "Finalizar treino" on the right (desktop). */
export function ActionBar({
  rest,
  next,
  doneSets,
  totalSets,
  canFinish,
  finished,
  blocked,
  onSkip,
  onFinish,
  hiddenOnPhone,
}: {
  rest: RestState | null
  next: { name: string; set: number } | null
  doneSets: number
  totalSets: number
  canFinish: boolean
  finished: boolean
  /** Why the workout cannot be finished although every set is checked (a day to come). */
  blocked: string | null
  onSkip: () => void
  onFinish: () => void
  /** The phone keyboard is open: the bar steps aside. */
  hiddenOnPhone: boolean
}) {
  const pct = totalSets === 0 ? 0 : (doneSets / totalSets) * 100
  const helper = finished ? "Treino registrado" : (blocked ?? "Marque todas as séries para finalizar")
  const enabled = canFinish && !finished && !blocked
  return (
    <div
      data-testid="action-bar"
      className={cn(
        "z-30 flex h-14 items-center gap-2 rounded-[20px] border border-border bg-card px-2.5 max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] md:sticky md:bottom-4 md:h-16 md:px-4",
        hiddenOnPhone && "max-md:hidden"
      )}
    >
      <div role="timer" aria-label="Descanso" className="flex min-w-0 flex-1 items-center gap-3">
        <RestRing rest={rest} />
        <div className="min-w-0 flex-1 max-md:hidden">
          <p className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Descanso</p>
          <p className="hidden truncate text-[13px] leading-5 text-muted-foreground md:block">{next ? `Próxima: ${next.name} · série ${next.set}` : "Todas as séries marcadas"}</p>
        </div>
        <span data-testid="rest-clock" className="tabular max-md:flex-1 text-[20px] leading-7 font-semibold md:text-2xl md:leading-8">
          {rest ? clock(rest.remaining) : "--:--"}
        </span>
        <Button variant="outline" className="h-9 rounded-full px-2.5 text-[13px] md:px-3 md:text-sm" disabled={!rest} onClick={onSkip}>
          Pular
        </Button>
      </div>
      <div className="hidden w-44 shrink-0 flex-col gap-1.5 md:flex">
        <p className="tabular text-[13px] leading-5">
          {doneSets} de {totalSets} séries
        </p>
        <HatchedProgress value={pct} label="Séries feitas" className="h-1.5" />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-testid="finish-workout"
            aria-disabled={!enabled}
            aria-describedby="finish-helper"
            className={cn("h-10 shrink-0 rounded-full px-3 text-[13px] md:px-4 md:text-sm", !enabled && "bg-muted text-muted-foreground hover:bg-muted")}
            onClick={() => {
              if (enabled) onFinish()
            }}
          >
            <CheckIcon strokeWidth={1.75} className="max-md:hidden" /> {finished ? "Treino registrado" : "Finalizar treino"}
          </Button>
        </TooltipTrigger>
        {!enabled ? <TooltipContent>{helper}</TooltipContent> : null}
      </Tooltip>
      <span id="finish-helper" className="sr-only">
        {helper}
      </span>
    </div>
  )
}
