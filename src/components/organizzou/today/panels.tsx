"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { AnnoyedIcon, ArrowUpRightIcon, CheckIcon, ChevronDownIcon, EllipsisIcon, FrownIcon, GlassWaterIcon, LaughIcon, MehIcon, PinIcon, SmileIcon, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { bentoCardClass } from "@/components/organizzou/Bento"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { panelMeta } from "@/features/today/catalog"
import type { DietData, FinanceData, NotesData, StudyData, WidgetState, WorkoutData } from "@/features/today/types"
import { MOOD_LABELS, type Mood } from "@/features/journal/types"
import { cn } from "@/lib/utils"

import { useTodayState } from "./today-state"

const clock = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
const liters = (ml: number) => `${(ml / 1000).toLocaleString("pt-BR")} L`
const hoursText = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`

const overline = "text-[11px] leading-4 font-semibold tracking-[0.12em] uppercase text-muted-foreground"

/**
 * Every panel except "Seu dia". From 768 px the body is always open. On phones the card is compact: the header row (title and the
 * key number) is always visible and tapping it folds the body, so the page stays short. Collapsed by default on phones.
 */
export function PanelCard({ id, keyNumber, href, state, children }: { id: string; keyNumber?: string; href: string; state: WidgetState; children: React.ReactNode }) {
  const meta = panelMeta(id)
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const Icon: LucideIcon | undefined = meta?.icon
  return (
    <section aria-label={meta?.title} className={cn(bentoCardClass(), "flex flex-col gap-4 rounded-[24px] p-5")}>
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:pointer-events-none"
        >
          {Icon ? <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" /> : null}
          <h2 className="min-w-0 flex-1 text-[17px] leading-6 font-semibold">{meta?.title}</h2>
          {state === "soon" ? <SoonBadge /> : keyNumber ? <span className="tabular shrink-0 text-[15px] leading-6 font-medium md:hidden">{keyNumber}</span> : null}
          <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none md:hidden", open && "rotate-180")} />
        </button>
        <Link
          href={href}
          aria-label={`Abrir ${meta?.title}`}
          className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-border outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 md:flex"
        >
          <ArrowUpRightIcon aria-hidden strokeWidth={1.75} className="size-4" />
        </Link>
      </header>
      <div id={bodyId} className={cn("min-w-0", !open && "max-md:hidden")}>
        {state === "soon" ? <p className="text-[15px] leading-6 text-muted-foreground">Este módulo ainda não tem dados reais. Em breve aparece aqui.</p> : children}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

export function FinancePanel({ data }: { data: FinanceData }) {
  return (
    <PanelCard id="financas" href="/dashboard/financas" state={data.state} keyNumber={data.surplus}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className={overline}>Sobra do mês</span>
            <span className="tabular flex items-center gap-1.5 text-xl leading-7 font-semibold">
              <ArrowUpRightIcon aria-hidden strokeWidth={1.75} className={cn("size-5", data.surplusTrend === "down" && "rotate-90")} />
              {data.surplus}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className={overline}>Orçamento</span>
            <span className="tabular text-xl leading-7 font-semibold">{data.budgetPct}%</span>
            <span className="tabular text-[13px] leading-5 text-muted-foreground">{data.budgetLine}</span>
          </div>
        </div>
        <Progress value={Math.min(100, data.budgetPct)} aria-label="Orçamento usado" />
      </div>
    </PanelCard>
  )
}

export function DietPanel({ data }: { data: DietData }) {
  const { waterMl, addWater } = useTodayState()
  const water = data.waterMl + waterMl
  return (
    <PanelCard id="dieta" href="/dashboard/dieta" state={data.state} keyNumber={`${data.kcal.toLocaleString("pt-BR")} kcal`}>
      <div className="flex flex-col gap-3">
        <div className="tabular flex justify-between gap-3 text-[15px] leading-6">
          <span>
            {data.kcal.toLocaleString("pt-BR")} <span className="text-muted-foreground">de {data.goalKcal.toLocaleString("pt-BR")} kcal</span>
          </span>
          <span className="text-muted-foreground">P {data.protein} g</span>
        </div>
        <Progress value={Math.min(100, (data.kcal / data.goalKcal) * 100)} aria-label="Calorias do dia" />
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="tabular text-[13px] leading-5 text-muted-foreground">
            Água: {liters(water)} de {liters(data.waterGoalMl)}
          </span>
          <Button variant="outline" className="h-11 rounded-full px-4" onClick={() => addWater(250)}>
            <GlassWaterIcon strokeWidth={1.75} /> + 250 ml
          </Button>
        </div>
      </div>
    </PanelCard>
  )
}

export function WorkoutPanel({ data }: { data: WorkoutData }) {
  return (
    <PanelCard id="treino" href="/dashboard/treinos" state={data.state} keyNumber={data.time ?? "Descanso"}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-[15px] leading-6">{data.title ?? "Dia de descanso"}</span>
          {data.time ? <Badge variant="secondary">{data.time}</Badge> : null}
        </div>
        {data.weekPlanned > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="tabular text-[13px] leading-5 text-muted-foreground">
              {data.weekDone} de {data.weekPlanned} treinos na semana
            </span>
            <Progress value={Math.min(100, Math.round((data.weekDone / data.weekPlanned) * 100))} aria-label="Treinos da semana" />
          </div>
        ) : null}
      </div>
    </PanelCard>
  )
}

export function StudyPanel({ data }: { data: StudyData }) {
  return (
    <PanelCard id="estudos" href="/dashboard/estudos" state={data.state} keyNumber={`${hoursText(data.studiedMin)} hoje`}>
      <div className="flex flex-col gap-3">
        <div className="tabular flex items-baseline justify-between gap-3 text-[15px] leading-6">
          <span>{hoursText(data.studiedMin)} hoje</span>
          <span className="text-[13px] text-muted-foreground">meta {hoursText(data.dailyGoalMin)}</span>
        </div>
        <Progress value={data.dailyGoalMin === 0 ? 0 : Math.min(100, Math.round((data.studiedMin / data.dailyGoalMin) * 100))} aria-label="Estudo de hoje" />
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Link href="/dashboard/estudos" className="flex min-h-11 items-center text-[15px] underline underline-offset-4">
            {data.dueCards} {data.dueCards === 1 ? "cartão para revisar" : "cartões para revisar"}
          </Link>
          {data.exam ? <Badge variant="highlight">{data.exam.days === 0 ? "prova hoje" : `prova em ${data.exam.days} ${data.exam.days === 1 ? "dia" : "dias"}`}</Badge> : null}
        </div>
        {data.exam ? <p className="text-[13px] leading-5 text-muted-foreground">{data.exam.title}</p> : null}
      </div>
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

export function MoodPanel() {
  const { mood, setMood } = useTodayState()
  return (
    <PanelCard id="humor" href="/dashboard/diario" state="ok" keyNumber={mood ? MOOD_LABELS[mood as Mood] : "Registrar"}>
      <div role="radiogroup" aria-label="Humor de hoje" className="flex flex-wrap gap-2">
        {MOODS.map(({ value, icon: Icon }) => (
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
              "flex size-12 items-center justify-center rounded-full border border-border outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              mood === value && "border-transparent bg-highlight text-highlight-foreground hover:bg-highlight"
            )}
          >
            <Icon aria-hidden strokeWidth={1.75} className="size-6" />
          </button>
        ))}
      </div>
      <p className="pt-4 text-[13px] leading-5 text-muted-foreground">Um toque por dia alimenta o gráfico do Diário.</p>
    </PanelCard>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

type Reminder = NotesData["reminders"][number]

/**
 * Next 3 reminders of today (time, title that wraps, "Feito" / "Adiar" in a ⋯ menu), up to 2 pinned notes (title + 2-line
 * preview) and a one-line quick note. Reminders are listed but never delivered yet: delivery stays "Em breve" (docs/INTEGRATIONS-STATUS.md).
 */
export function NotesPanel({ data }: { data: NotesData }) {
  const [reminders, setReminders] = useState<Reminder[]>(data.reminders)
  const [quick, setQuick] = useState<{ id: string; title: string }[]>([])
  const [draft, setDraft] = useState("")

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

  return (
    <PanelCard id="notas" href="/dashboard/notas" state={data.state} keyNumber={`${reminders.length} ${reminders.length === 1 ? "lembrete" : "lembretes"}`}>
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-center justify-between gap-2 pb-1">
            <h3 className={overline}>Lembretes de hoje</h3>
            <SoonBadge />
          </div>
          {reminders.length === 0 ? (
            <p className="py-2 text-[15px] leading-6 text-muted-foreground">Nenhum lembrete para o resto do dia.</p>
          ) : (
            <ul>
              {reminders.map((reminder) => (
                <li key={reminder.id} className="flex min-h-14 items-center gap-3 border-b border-border py-2 last:border-b-0">
                  <span className="tabular w-12 shrink-0 text-[13px] leading-5 text-muted-foreground">{clock(reminder.at)}</span>
                  <span className="min-w-0 flex-1 text-[15px] leading-6 break-words">{reminder.title}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" aria-label={`Ações do lembrete: ${reminder.title}`}>
                        <EllipsisIcon strokeWidth={1.75} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-48 rounded-2xl p-2">
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

        {data.pinned.length > 0 || quick.length > 0 ? (
          <div>
            <h3 className={cn(overline, "pb-1")}>Notas fixadas</h3>
            <ul>
              {quick.map((note) => (
                <li key={note.id} className="border-b border-border last:border-b-0">
                  <Link href="/dashboard/notas" className="flex min-h-14 flex-col justify-center rounded-md py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className="text-[15px] leading-6 font-medium break-words">{note.title}</span>
                    <span className="text-[13px] leading-5 text-muted-foreground">Nota rápida · só nesta visita, as notas ainda são simuladas</span>
                  </Link>
                </li>
              ))}
              {data.pinned.map((note) => (
                <li key={note.id} className="border-b border-border last:border-b-0">
                  <Link href="/dashboard/notas" className="flex min-h-14 flex-col justify-center rounded-md py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className="flex items-center gap-2 text-[15px] leading-6 font-medium">
                      <PinIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 break-words">{note.title}</span>
                    </span>
                    <span className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">{note.preview}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            createQuick()
          }}
        >
          <label className="sr-only" htmlFor="quick-note">
            Nota rápida
          </label>
          <Input
            id="quick-note"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nota rápida: escreva e tecle Enter"
            autoComplete="off"
            enterKeyHint="done"
            className="h-11 rounded-full bg-card px-4 text-[15px]"
          />
        </form>
      </div>
    </PanelCard>
  )
}
