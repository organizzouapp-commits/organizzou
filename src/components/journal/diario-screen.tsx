"use client"

import { useEffect, useState } from "react"
import { CheckCheckIcon, CheckIcon, DumbbellIcon, EllipsisIcon, FlameIcon, GraduationCapIcon, MoonIcon, PlusIcon, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { BentoCard, BentoStat, SegmentedPills } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { HatchedProgress, HeroCard, LIST_CARD } from "@/components/finance/parts"
import { MoodChart, SleepChart } from "@/components/journal/journal-charts"
import { EditEntrySheet, EntriesList, type EntryValues } from "@/components/journal/journal-entries"
import { MoodPicker, SleepRow } from "@/components/journal/mood-picker"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { moodInsights } from "@/features/journal/insights"
import { DEFAULT_SLEEP_GOAL, JOURNAL_PERIODS, checkinStreak, dailyPoints, formatDiff, formatMood, insightsProgress, localJournalSettingsRepo, moodAverage, periodEntries, sleepAverage, sleepText, type JournalPeriod } from "@/features/journal/stats"
import type { JournalDay, Mood } from "@/features/journal/types"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import { dayOf, newId } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

const USER = "00000000-0000-4000-8000-000000000001"
const INSIGHT_ICONS: Record<string, LucideIcon> = { sleep: MoonIcon, workout: DumbbellIcon, study: GraduationCapIcon }
const chip = "tabular inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const dim = (text: string) => <span className="text-[16px] leading-6 opacity-60">{text}</span>
const SMALL_CAPS = "text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase"

export function DiarioScreen({ nowIso, initial }: { nowIso: string; initial: JournalDay[] }) {
  const today = dayOf(nowIso)
  const isMobile = useIsMobile()
  const [days, setDays] = usePersistedRows<JournalDay>("journal_entries", initial)
  const [period, setPeriod] = useState<JournalPeriod>(30)
  const [editing, setEditing] = useState<JournalDay | null>(null)
  const [toDelete, setToDelete] = useState<JournalDay | null>(null)
  // The sleep goal: localStorage until the profile settings have a column for it (see features/journal/stats.ts).
  const [goal, setGoal] = useState(DEFAULT_SLEEP_GOAL)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoal(localJournalSettingsRepo.load().sleepGoal)
  }, [])

  const todayEntry = days.find((d) => d.entry_date === today)
  const sorted = [...days].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  const inPeriod = periodEntries(sorted, today, period)
  const points = dailyPoints(inPeriod, today, period)
  const average = moodAverage(inPeriod)
  const sleep = sleepAverage(inPeriod, goal)
  const streak = checkinStreak(sorted, today)
  // The insights look at the whole history (not at today, which may still be incomplete).
  const history = sorted.filter((d) => d.entry_date !== today)
  const insights = moodInsights(history)
  const progress = insightsProgress(history.length)

  // ---------------------------------------------------------- actions
  function saveToday(values: EntryValues) {
    const stamp = new Date().toISOString()
    const previous = todayEntry
    const entry: JournalDay = { id: previous?.id ?? newId(), user_id: USER, entry_date: today, mood: values.mood, text: values.text, sleep_hours: values.sleep_hours, created_at: previous?.created_at ?? stamp, updated_at: stamp, trained: previous?.trained ?? false, studied_min: previous?.studied_min ?? 0 }
    setDays((current) => [...current.filter((d) => d.entry_date !== today), entry])
    toast.success("Check-in salvo.", {
      action: {
        label: "Desfazer",
        onClick: () => setDays((current) => [...current.filter((d) => d.entry_date !== today), ...(previous ? [previous] : [])]),
      },
    })
  }

  function saveEdit(entry: JournalDay, values: EntryValues) {
    setDays((current) => current.map((d) => (d.id === entry.id ? { ...d, ...values, updated_at: new Date().toISOString() } : d)))
    toast.success("Registro atualizado.")
  }

  function deleteEntry(entry: JournalDay) {
    setDays((current) => current.filter((d) => d.id !== entry.id))
    toast("Registro excluído.", { action: { label: "Desfazer", onClick: () => setDays((current) => [...current.filter((d) => d.id !== entry.id), entry]) } })
  }

  async function copyNote(entry: JournalDay) {
    if (!entry.text) return void toast("Esse registro não tem anotação.")
    try {
      await navigator.clipboard.writeText(entry.text)
      toast.success("Anotação copiada.")
    } catch {
      toast("Não consegui copiar. Selecione o texto na edição.")
    }
  }

  // ---------------------------------------------------------- summary
  const height = isMobile ? "h-[200px]" : "h-48"
  const hero = <HeroCard key="hero" className={height} density="dense" label="Humor médio" value={<>{formatMood(average)} {dim("/ 5")}</>} support={`nos últimos ${period} dias`} progress={{ value: average === null ? 0 : (average / 5) * 100, label: `Humor médio: ${formatMood(average)} de 5` }} />
  const sleepCard = (
    <BentoStat key="sleep" label="Sono médio" icon={MoonIcon} className={height} chip={`meta: ${sleepText(goal)}`} footer={<HatchedProgress value={sleep.percent} label={`Sono médio: ${sleep.percent}% da meta`} />}>
      {sleep.average === null ? "—" : <>{formatMood(sleep.average)} {dim("h")}</>}
    </BentoStat>
  )
  const checkins = (
    <BentoStat key="checkins" label="Check-ins" icon={CheckCheckIcon} className={height} chip="registrados">
      {inPeriod.length} {dim(inPeriod.length === 1 ? "dia" : "dias")}
    </BentoStat>
  )
  const streakCard = (
    <BentoStat key="streak" label="Sequência" icon={FlameIcon} className={height} chip={`recorde: ${streak.record} ${streak.record === 1 ? "dia" : "dias"}`}>
      {streak.current} {dim(streak.current === 1 ? "dia" : "dias")}
    </BentoStat>
  )

  const periodSwitch = <SegmentedPills ariaLabel="Período" items={JOURNAL_PERIODS.map((p) => ({ id: String(p), label: `${p} dias` }))} value={String(period)} onChange={(id) => setPeriod(Number(id) as JournalPeriod)} className={isMobile ? "w-full [&>button]:flex-1" : undefined} />

  // ---------------------------------------------------------- insights
  const insightsCard = (
    <BentoCard title="O que combina com seus melhores dias" subtitle="Diferença no humor médio quando o hábito acontece." data-testid="journal-insights" className="h-full">
      {progress.enough ? (
        <ul className="flex flex-col gap-3">
          {insights.map((insight) => {
            const Icon = INSIGHT_ICONS[insight.key]
            const diff = formatDiff(insight.withAvg, insight.withoutAvg)
            return (
              <li key={insight.key} data-insight={insight.key} className={cn(LIST_CARD, "flex items-center gap-3 p-3")}>
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border">
                  <Icon strokeWidth={1.75} className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14px] leading-5">
                    Nos dias em que você <strong className="font-semibold">{insight.label}</strong>, o humor médio foi <span className="tabular font-semibold">{formatMood(insight.withAvg)}</span>
                  </span>
                  <span className="tabular text-[12px] leading-4 text-muted-foreground">
                    contra {formatMood(insight.withoutAvg)} nos outros dias ({insight.withCount} e {insight.withoutCount} dias)
                  </span>
                </div>
                {diff !== null ? (
                  <span data-chip="diff" aria-label={`diferença de ${diff}`} className={chip}>
                    {diff}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <div data-testid="insights-empty" className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
          <span aria-hidden className="flex size-12 items-center justify-center rounded-full border border-border">
            <CheckCheckIcon strokeWidth={1.75} className="size-5" />
          </span>
          <p className="text-[16px] leading-6 font-semibold">Faltam {progress.missing} check-ins</p>
          <p className="max-w-64 text-[13px] leading-5 text-muted-foreground">Com {progress.total} dias registrados, mostramos o que combina com os seus melhores dias.</p>
          <HatchedProgress value={(history.length / progress.total) * 100} label={`${history.length} de ${progress.total} dias registrados`} className="max-w-64" />
          <span data-chip className={chip}>
            {history.length} de {progress.total} dias
          </span>
        </div>
      )}
    </BentoCard>
  )

  return (
    <div className="@container flex min-w-0 flex-col gap-4" data-testid="diario">
      <PageHeader />

      {isMobile ? (
        <section aria-label="Diário" data-testid="diario-header-block" className="mt-3 flex items-center gap-2 rounded-[20px] border border-border bg-card p-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[18px] leading-6 font-semibold">Diário</h2>
            <p className="truncate text-[13px] leading-5 text-muted-foreground">Um minuto por dia para entender seu humor.</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Opções do diário" data-testid="diario-options" className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-1">
                <EllipsisIcon strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => document.getElementById("checkin")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                <PlusIcon strokeWidth={1.75} /> Check-in de hoje
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </section>
      ) : (
        <div className="flex justify-end">{periodSwitch}</div>
      )}

      {isMobile ? (
        <FinanceDeck title={null} label="Resumo do diário" noun="resumo" initialHeight={200} slides={[{ id: "hero", hero: true, node: hero }, { id: "sleep", node: sleepCard }, { id: "checkins", node: checkins }, { id: "streak", node: streakCard }]} />
      ) : (
        <div data-testid="journal-summary" className="grid grid-cols-2 gap-4 @min-[880px]:grid-cols-4">
          {[hero, sleepCard, checkins, streakCard].map((card, i) => (
            <div key={i} className="flex min-w-0 flex-col [&>*]:flex-1">
              {card}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
        <div id="checkin" className="min-w-0 scroll-mt-4 @min-[880px]:col-span-8">
          <CheckinCard key={`${todayEntry?.id ?? "new"}-${todayEntry?.updated_at ?? ""}`} entry={todayEntry} mobile={isMobile} onSave={saveToday} />
        </div>
        <div className="min-w-0 @min-[880px]:col-span-4">{insightsCard}</div>
      </div>

      {isMobile ? periodSwitch : null}

      <div className="grid grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
        <div className="min-w-0 @min-[880px]:col-span-7 @min-[880px]:h-[340px]">
          <MoodChart points={points} average={average} period={period} mobile={isMobile} />
        </div>
        <div className="min-w-0 @min-[880px]:col-span-5 @min-[880px]:h-[340px]">
          <SleepChart points={points} average={sleep.average} goal={goal} mobile={isMobile} />
        </div>
      </div>

      <EntriesList entries={sorted} mobile={isMobile} onEdit={setEditing} onCopy={copyNote} onDelete={setToDelete} />

      <EditEntrySheet entry={editing} mobile={isMobile} onClose={() => setEditing(null)} onSave={saveEdit} onDelete={setToDelete} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir este registro?"
        description={toDelete ? "O humor, a anotação e o sono desse dia serão apagados. Você pode desfazer logo depois." : ""}
        onConfirm={() => {
          const entry = toDelete
          setToDelete(null)
          if (entry) deleteEntry(entry)
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------------ "Como foi hoje?"

function CheckinCard({ entry, mobile, onSave }: { entry: JournalDay | undefined; mobile: boolean; onSave: (values: EntryValues) => void }) {
  const [mood, setMood] = useState<Mood | null>(entry?.mood ?? null)
  const [text, setText] = useState(entry?.text ?? "")
  const [sleep, setSleep] = useState(entry?.sleep_hours ?? 7)
  return (
    <BentoCard
      title="Como foi hoje?"
      data-testid="checkin"
      className="h-full md:p-6"
      actions={
        entry ? (
          <span data-chip data-testid="checkin-saved" className={chip}>
            <CheckIcon aria-hidden strokeWidth={2} className="size-3" /> Check-in de hoje salvo
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-1 flex-col gap-5">
        <MoodPicker value={mood} onChange={setMood} label="Humor de hoje" mobile={mobile} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="journal-text" className={SMALL_CAPS}>
            Quer anotar alguma coisa?
          </Label>
          <Textarea id="journal-text" value={text} maxLength={1000} placeholder="O que aconteceu, o que você sentiu…" onChange={(e) => setText(e.target.value)} className="min-h-[72px] rounded-[12px] px-3 py-2.5 text-[15px] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" />
        </div>
        <hr className="border-border" />
        <SleepRow value={sleep} onChange={setSleep} />
        <div className="flex md:justify-end">
          <Button type="button" data-testid="save-checkin" disabled={!mood} onClick={() => mood && onSave({ mood, text: text.trim(), sleep_hours: sleep })} className="h-12 w-full rounded-full bg-highlight px-8 text-[15px] text-highlight-foreground hover:bg-highlight/90 md:w-auto">
            {entry ? "Atualizar check-in" : "Salvar check-in"}
          </Button>
        </div>
      </div>
    </BentoCard>
  )
}
