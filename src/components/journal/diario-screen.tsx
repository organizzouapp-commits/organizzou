"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  AnnoyedIcon,
  DumbbellIcon,
  FrownIcon,
  GraduationCapIcon,
  LaughIcon,
  MehIcon,
  MinusIcon,
  MoonIcon,
  PlusIcon,
  SmileIcon,
  type LucideIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { Bento, BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { average, moodInsights } from "@/features/journal/insights"
import { MOOD_LABELS, type JournalDay, type Mood } from "@/features/journal/types"
import { cn } from "@/lib/utils"
import { buildMockJournal } from "@/mocks/journal"
import { dayOf, mockId } from "@/mocks/time"

const MOODS: { value: Mood; icon: LucideIcon }[] = [
  { value: 1, icon: FrownIcon },
  { value: 2, icon: AnnoyedIcon },
  { value: 3, icon: MehIcon },
  { value: 4, icon: SmileIcon },
  { value: 5, icon: LaughIcon },
]

const moodConfig = { mood: { label: "Humor", color: "var(--chart-1)" } } satisfies ChartConfig
const sleepConfig = { sleep: { label: "Sono (h)", color: "var(--chart-4)" } } satisfies ChartConfig

const INSIGHT_ICONS = { sleep: MoonIcon, workout: DumbbellIcon, study: GraduationCapIcon }

function formatAvg(value: number | null) {
  return value === null ? "—" : value.toLocaleString("pt-BR", { minimumFractionDigits: 1 })
}

export function DiarioScreen({ nowIso }: { nowIso: string }) {
  const today = dayOf(nowIso)
  const [days, setDays] = useState<JournalDay[]>(() => buildMockJournal(nowIso))
  const todayEntry = days.find((d) => d.entry_date === today)
  const [mood, setMood] = useState<Mood | null>(todayEntry?.mood ?? null)
  const [text, setText] = useState(todayEntry?.text ?? "")
  const [sleep, setSleep] = useState(todayEntry?.sleep_hours ?? 7)

  function save() {
    if (!mood) return
    const stamp = new Date().toISOString()
    setDays((current) => [
      ...current.filter((d) => d.entry_date !== today),
      {
        id: todayEntry?.id ?? mockId("jr"),
        user_id: "00000000-0000-4000-8000-000000000001",
        entry_date: today,
        mood,
        text: text.trim(),
        sleep_hours: sleep,
        created_at: todayEntry?.created_at ?? stamp,
        updated_at: stamp,
        trained: false,
        studied_min: 0,
      },
    ])
    toast.success("Check-in salvo.")
  }

  const sorted = [...days].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  const series = sorted.map((d) => ({ label: format(parseISO(d.entry_date), "dd/MM"), mood: d.mood, sleep: d.sleep_hours ?? 0 }))
  const insights = moodInsights(sorted.filter((d) => d.entry_date !== today))
  const history = [...sorted].reverse().slice(0, 12)

  const moodAverage = average(sorted.map((d) => d.mood))
  const sleepAverage = average(sorted.map((d) => d.sleep_hours ?? 0).filter((h) => h > 0))
  const loggedDays = sorted.length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader />
      <Bento>
      <KpiCard tone="highlight" label="Humor médio" value={moodAverage === null ? "—" : moodAverage.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} support="nos últimos 30 dias" className="col-span-12 sm:col-span-4" />
      <KpiCard label="Sono médio" value={sleepAverage === null ? "—" : `${sleepAverage.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} h`} support="por noite" className="col-span-6 sm:col-span-4" />
      <KpiCard label="Check-ins" value={`${loggedDays}`} support="dias registrados" className="col-span-6 sm:col-span-4" />

      <BentoCard title="Como foi hoje?" className="col-span-12 lg:col-span-7" bodyClassName="flex flex-col gap-5">
        <div role="radiogroup" aria-label="Humor de hoje" className="flex flex-wrap gap-2">
          {MOODS.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mood === value}
              onClick={() => setMood(value)}
              className={cn(
                "flex min-h-20 min-w-[4.25rem] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border px-2 text-[13px] leading-5 outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                mood === value && "border-transparent bg-highlight font-semibold text-highlight-foreground hover:bg-highlight"
              )}
            >
              <Icon aria-hidden strokeWidth={1.75} className="size-6" />
              {MOOD_LABELS[value]}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="journal-text">Quer anotar alguma coisa?</Label>
          <Textarea id="journal-text" value={text} maxLength={1000} placeholder="O que aconteceu, o que você sentiu…" onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MoonIcon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
            <span className="text-[15px] leading-6">Sono de ontem para hoje</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" aria-label="Menos meia hora" disabled={sleep <= 0} onClick={() => setSleep((s) => Math.max(0, s - 0.5))}>
                <MinusIcon strokeWidth={1.75} />
              </Button>
              <span className="tabular w-14 text-center text-[15px] leading-6 font-medium">{sleep.toLocaleString("pt-BR")} h</span>
              <Button variant="outline" size="icon-sm" aria-label="Mais meia hora" disabled={sleep >= 14} onClick={() => setSleep((s) => Math.min(14, s + 0.5))}>
                <PlusIcon strokeWidth={1.75} />
              </Button>
            </div>
          </div>
          <Button disabled={!mood} onClick={save}>
            {todayEntry ? "Atualizar check-in" : "Salvar check-in"}
          </Button>
        </div>
      </BentoCard>

      <BentoCard title="O que combina com seus melhores dias" className="col-span-12 lg:col-span-5">
        <div>
          {insights.map((insight) => {
            const Icon = INSIGHT_ICONS[insight.key]
            const diff = insight.withAvg !== null && insight.withoutAvg !== null ? Math.round((insight.withAvg - insight.withoutAvg) * 10) / 10 : null
            return (
              <div key={insight.key} className="flex min-h-16 items-center gap-4 border-b border-border py-3 last:border-b-0">
                <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] leading-6">
                    Nos dias em que você <strong className="font-semibold">{insight.label}</strong>, o humor médio foi{" "}
                    <span className="tabular font-semibold">{formatAvg(insight.withAvg)}</span>
                  </span>
                  <span className="tabular text-[13px] leading-5 text-muted-foreground">
                    contra {formatAvg(insight.withoutAvg)} nos outros dias ({insight.withCount} e {insight.withoutCount} dias)
                  </span>
                </div>
                {diff !== null ? <span className="tabular text-[15px] font-medium">{diff >= 0 ? "+" : "−"}{Math.abs(diff).toLocaleString("pt-BR")}</span> : null}
              </div>
            )
          })}
        </div>
      </BentoCard>

      <BentoCard title="Humor nos últimos 30 dias" className="col-span-12 lg:col-span-6">
        <ChartContainer config={moodConfig} className="aspect-[16/8] w-full">
          <LineChart data={series} margin={{ left: -16, right: 8 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.5} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="mood" type="monotone" stroke="var(--color-mood)" strokeWidth={1.75} dot={false} />
          </LineChart>
        </ChartContainer>
      </BentoCard>

      <BentoCard title="Horas de sono" className="col-span-12 lg:col-span-6">
        <ChartContainer config={sleepConfig} className="aspect-[16/8] w-full">
          <BarChart data={series} margin={{ left: -16, right: 8 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.5} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="sleep" fill="var(--color-sleep)" radius={4} />
          </BarChart>
        </ChartContainer>
      </BentoCard>

      <BentoCard title="Últimos registros" className="col-span-12">
        {history.map((entry) => {
          const Icon = MOODS.find((m) => m.value === entry.mood)?.icon ?? MehIcon
          return (
            <div key={entry.id} className="flex min-h-14 items-start gap-4 border-b border-border py-3 last:border-b-0">
              <Icon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] leading-6">
                  {format(parseISO(entry.entry_date), "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())} ·{" "}
                  <span className="text-muted-foreground">{MOOD_LABELS[entry.mood]}</span>
                </span>
                {entry.text ? <span className="text-[13px] leading-5 text-muted-foreground">{entry.text}</span> : null}
              </div>
              {entry.sleep_hours ? <span className="tabular text-[13px] leading-5 text-muted-foreground">{entry.sleep_hours.toLocaleString("pt-BR")} h</span> : null}
            </div>
          )
        })}
      </BentoCard>
      </Bento>
    </div>
  )
}
