"use client"

import { useEffect, useState } from "react"
import { format, parseISO, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  BookOpenIcon,
  BookMarkedIcon,
  CheckIcon,
  GraduationCapIcon,
  LibraryIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  SparklesIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { Bento, BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { SwatchPicker } from "@/components/organizzou/SwatchPicker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { daysUntil, isDue, review, type Rating } from "@/features/studies/spaced-repetition"
import {
  PRIORITY_LABELS,
  SUBJECT_TYPE_LABELS,
  type DeadlineRow,
  type FlashcardRow,
  type Priority,
  type StudySessionRow,
  type SubjectRow,
  type SubjectType,
} from "@/features/studies/types"
import type { SwatchId } from "@/lib/swatches"
import { cn } from "@/lib/utils"
import { studyTemplates } from "@/mocks/schedule"
import {
  buildMockCards,
  buildMockDeadlines,
  buildMockSessions,
  generatedCards,
  mockDecks,
  mockSubjects,
} from "@/mocks/studies"
import { dayOf, mockId } from "@/mocks/time"

const USER = "00000000-0000-4000-8000-000000000001"
const TYPE_ICONS: Record<SubjectType, LucideIcon> = {
  subject: BookOpenIcon,
  course: GraduationCapIcon,
  book: BookMarkedIcon,
  exam: TargetIcon,
}

const MODES = [
  { value: "focus", label: "Foco", minutes: 25 },
  { value: "short", label: "Pausa", minutes: 5 },
  { value: "long", label: "Pausa longa", minutes: 15 },
] as const

const hoursConfig = { hours: { label: "Horas", color: "var(--chart-1)" } } satisfies ChartConfig

function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

function hours(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`
}

export function EstudosScreen({ nowIso }: { nowIso: string }) {
  const today = dayOf(nowIso)
  const weekStart = format(startOfWeek(parseISO(today), { weekStartsOn: 1 }), "yyyy-MM-dd")
  const [subjects, setSubjects] = useState<SubjectRow[]>(mockSubjects)
  const [sessions, setSessions] = useState<StudySessionRow[]>(() => buildMockSessions(nowIso))
  const [deadlines, setDeadlines] = useState<DeadlineRow[]>(() => buildMockDeadlines(nowIso))
  const [cards, setCards] = useState<FlashcardRow[]>(() => buildMockCards(nowIso))
  const [creatingSubject, setCreatingSubject] = useState(false)
  const [creatingDeadline, setCreatingDeadline] = useState(false)
  const [studyDeck, setStudyDeck] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  // Pomodoro
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("focus")
  const modeMinutes = MODES.find((m) => m.value === mode)?.minutes ?? 25
  const [remaining, setRemaining] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [timerSubject, setTimerSubject] = useState(subjects[0].id)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => window.clearInterval(id)
  }, [running])

  const [finishedHandled, setFinishedHandled] = useState(false)
  if (running && remaining === 0 && !finishedHandled) {
    setFinishedHandled(true)
    setRunning(false)
    if (mode === "focus") {
      setSessions((current) => [
        ...current,
        { id: mockId("ses"), user_id: USER, subject_id: timerSubject, studied_on: today, minutes: modeMinutes, mode: "pomodoro" },
      ])
      toast.success(`Sessão registrada: ${modeMinutes} min de ${subjects.find((s) => s.id === timerSubject)?.name}.`)
    } else {
      toast("Pausa terminada. Bora voltar ao foco?")
    }
  }

  function changeMode(value: string) {
    const next = MODES.find((m) => m.value === value)
    if (!next) return
    setMode(next.value)
    setRunning(false)
    setFinishedHandled(false)
    setRemaining(next.minutes * 60)
  }

  function toggleTimer() {
    if (remaining === 0) {
      setRemaining(modeMinutes * 60)
      setFinishedHandled(false)
    }
    setRunning((r) => !r)
  }

  function logElapsed() {
    const elapsedMin = Math.floor((modeMinutes * 60 - remaining) / 60)
    if (mode !== "focus" || elapsedMin < 1) {
      toast("Estude pelo menos 1 minuto em foco para registrar.")
      return
    }
    setSessions((current) => [...current, { id: mockId("ses"), user_id: USER, subject_id: timerSubject, studied_on: today, minutes: elapsedMin, mode: "free" }])
    setRunning(false)
    setRemaining(modeMinutes * 60)
    toast.success(`${elapsedMin} min registrados.`)
  }

  // Stats
  const weekMinutes = (subjectId?: string) =>
    sessions.filter((s) => s.studied_on >= weekStart && (!subjectId || s.subject_id === subjectId)).reduce((sum, s) => sum + s.minutes, 0)
  const totalWeek = weekMinutes()
  const totalGoal = subjects.reduce((sum, s) => sum + s.weekly_goal_min, 0)
  const todayMinutes = sessions.filter((s) => s.studied_on === today).reduce((sum, s) => sum + s.minutes, 0)
  const bySubject = subjects
    .map((s) => ({ subject: s, minutes: weekMinutes(s.id) }))
    .sort((a, b) => b.minutes - a.minutes)
  const chartData = bySubject.map((r) => ({ name: r.subject.name.split(" — ")[0], hours: Math.round((r.minutes / 60) * 10) / 10 }))
  const upcoming = [...deadlines].sort((a, b) => a.due_on.localeCompare(b.due_on))
  const dueCards = cards.filter((c) => isDue(c, today))
  const todaysBlocks = studyTemplates.filter((t) => t.weekdays.includes(parseISO(today).getDay()))

  usePrimaryAction("Nova matéria", () => setCreatingSubject(true))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader />

      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="materias">Matérias</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="provas">Provas e prazos</TabsTrigger>
        </TabsList>

        {/* ----------------------------------------------------------- today */}
        <TabsContent value="hoje" className="pt-5">
          <Bento>
          <KpiCard tone="highlight" label="Estudado hoje" value={hours(todayMinutes)} support="foco + sessões livres" className="col-span-12 sm:col-span-4" />
          <KpiCard label="Semana" value={hours(totalWeek)} support={`meta ${hours(totalGoal)}`} className="col-span-6 sm:col-span-4" />
          <KpiCard label="Flashcards" value={`${dueCards.length}`} support="para revisar" href="/estudos" className="col-span-6 sm:col-span-4" />
          <BentoCard title="Foco" className="col-span-12 lg:col-span-5" bodyClassName="flex flex-col gap-5">
            <Tabs value={mode} onValueChange={changeMode}>
              <TabsList>
                {MODES.map((m) => (
                  <TabsTrigger key={m.value} value={m.value}>
                    {m.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div role="timer" aria-label="Cronômetro de foco" className="tabular text-[64px] leading-[72px] font-semibold tracking-[-0.03em]">
              {clock(remaining)}
            </div>
            <Progress value={((modeMinutes * 60 - remaining) / (modeMinutes * 60)) * 100} aria-label="Progresso da sessão" />
            <div className="flex flex-col gap-2">
              <Label htmlFor="timer-subject">Estudando</Label>
              <Select value={timerSubject} onValueChange={setTimerSubject}>
                <SelectTrigger id="timer-subject" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={toggleTimer}>
                {running ? <PauseIcon strokeWidth={1.75} /> : <PlayIcon strokeWidth={1.75} />}
                {running ? "Pausar" : remaining === modeMinutes * 60 ? "Começar" : "Continuar"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  setRunning(false)
                  setRemaining(modeMinutes * 60)
                  setFinishedHandled(false)
                }}
              >
                <RotateCcwIcon strokeWidth={1.75} /> Zerar
              </Button>
              <Button size="lg" variant="ghost" onClick={logElapsed}>
                <CheckIcon strokeWidth={1.75} /> Registrar o que estudei
              </Button>
            </div>
          </BentoCard>

          <BentoCard title="Horas por matéria nesta semana" className="col-span-12 lg:col-span-7">
            <ChartContainer config={hoursConfig} className="aspect-[16/9] w-full">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} strokeOpacity={0.5} />
                <XAxis type="number" tickLine={false} axisLine={false} unit=" h" />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="hours" fill="var(--color-hours)" radius={6} />
              </BarChart>
            </ChartContainer>
          </BentoCard>

          <BentoCard title="Blocos de hoje" className="col-span-12 lg:col-span-4">
            {todaysBlocks.length === 0 ? (
              <p className="py-2 text-[15px] leading-6 text-muted-foreground">Nenhum bloco no cronograma de hoje.</p>
            ) : (
              todaysBlocks.map((b) => (
                <div key={b.title} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                  <GraduationCapIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-[15px] leading-6">{b.title}</span>
                  <span className="tabular text-[13px] leading-5 text-muted-foreground">
                    {b.time} · {hours(b.minutes)}
                  </span>
                </div>
              ))
            )}
          </BentoCard>

          <BentoCard title="Contagem regressiva" className="col-span-12 md:col-span-6 lg:col-span-4">
            {upcoming.slice(0, 3).map((d) => (
              <div key={d.id} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                <span className="flex-1 text-[15px] leading-6">{d.title}</span>
                <Badge variant={daysUntil(d.due_on, today) <= 10 ? "highlight" : "secondary"}>
                  {daysUntil(d.due_on, today) === 0 ? "Hoje" : `${daysUntil(d.due_on, today)} dias`}
                </Badge>
              </div>
            ))}
          </BentoCard>

          <BentoCard title="Ranking da semana" className="col-span-12 md:col-span-6 lg:col-span-4">
            {bySubject.map((r, index) => (
              <div key={r.subject.id} className="flex min-h-12 items-center gap-4 border-b border-border py-2 last:border-b-0">
                <span className="tabular w-5 text-[13px] leading-5 text-muted-foreground">{index + 1}</span>
                <span className="flex-1 truncate text-[15px] leading-6">{r.subject.name}</span>
                <span className="tabular text-[13px] leading-5 text-muted-foreground">{hours(r.minutes)}</span>
              </div>
            ))}
          </BentoCard>
          </Bento>
        </TabsContent>

        {/* -------------------------------------------------------- subjects */}
        <TabsContent value="materias" className="pt-5">
          <Bento>
          {subjects.map((s) => {
            const Icon = TYPE_ICONS[s.type]
            const done = weekMinutes(s.id)
            return (
              <BentoCard key={s.id} className="col-span-12 lg:col-span-6" bodyClassName="flex flex-col gap-3">
                <div className="flex items-start gap-4">
                  <Icon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[17px] leading-6 font-semibold">{s.name}</span>
                    <span className="text-[13px] leading-5 text-muted-foreground">
                      {SUBJECT_TYPE_LABELS[s.type]} · prioridade {PRIORITY_LABELS[s.priority].toLowerCase()}
                      {s.progress_label ? ` · ${s.progress_label}` : ""}
                    </span>
                  </div>
                  <Badge variant={s.priority === "high" ? "default" : "secondary"}>{PRIORITY_LABELS[s.priority]}</Badge>
                </div>
                <div className="flex flex-col gap-2 pl-9">
                  <div className="tabular flex justify-between text-[13px] leading-5">
                    <span>Meta da semana</span>
                    <span className="text-muted-foreground">
                      {hours(done)} de {hours(s.weekly_goal_min)}
                    </span>
                  </div>
                  <Progress value={Math.min(100, (done / s.weekly_goal_min) * 100)} aria-label={`Meta semanal de ${s.name}`} />
                  {s.progress_pct !== null ? (
                    <>
                      <div className="tabular flex justify-between text-[13px] leading-5">
                        <span>Andamento</span>
                        <span className="text-muted-foreground">{s.progress_pct}%</span>
                      </div>
                      <Progress value={s.progress_pct} aria-label={`Andamento de ${s.name}`} />
                    </>
                  ) : null}
                </div>
              </BentoCard>
            )
          })}
          </Bento>
        </TabsContent>

        {/* ------------------------------------------------------ flashcards */}
        <TabsContent value="flashcards" className="pt-5">
          <Bento>
          <BentoCard
            title="Baralhos"
            className="col-span-12 lg:col-span-8"
            actions={
            <Button
              size="sm"
              variant="outline"
              disabled={generating}
              onClick={() => {
                setGenerating(true)
                window.setTimeout(() => {
                  setCards((current) => [
                    ...current,
                    ...generatedCards.map((c) => ({
                      id: mockId("fc"),
                      deck_id: mockDecks[0].id,
                      front: c.front,
                      back: c.back,
                      ease: 2.5,
                      interval_days: 0,
                      repetitions: 0,
                      due_on: today,
                    })),
                  ])
                  setGenerating(false)
                  toast.success("4 flashcards gerados a partir das suas anotações.")
                }, 1200)
              }}
            >
              <SparklesIcon strokeWidth={1.75} /> {generating ? "Gerando…" : "Gerar com IA"}
            </Button>
            }
          >
          <p className="pb-2 text-[15px] leading-6 text-muted-foreground">
            {dueCards.length === 0 ? "Nada para revisar hoje." : `${dueCards.length} cartões para revisar hoje.`}
          </p>
          {generating ? <Skeleton className="h-16 w-full" /> : null}
          {mockDecks.map((deck) => {
            const list = cards.filter((c) => c.deck_id === deck.id)
            const due = list.filter((c) => isDue(c, today))
            return (
              <div key={deck.id} className="flex min-h-16 items-center gap-4 border-b border-border py-3 last:border-b-0">
                <LibraryIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] leading-6">{deck.name}</span>
                  <span className="tabular text-[13px] leading-5 text-muted-foreground">
                    {list.length} cartões · {due.length} para revisar
                  </span>
                </div>
                <Button variant={due.length > 0 ? "default" : "outline"} disabled={due.length === 0} onClick={() => setStudyDeck(deck.id)}>
                  Estudar
                </Button>
              </div>
            )
          })}
          </BentoCard>
          </Bento>
        </TabsContent>

        {/* --------------------------------------------------------- deadlines */}
        <TabsContent value="provas" className="pt-5">
          <Bento>
          <BentoCard
            title="Provas e prazos"
            className="col-span-12 lg:col-span-8"
            actions={
              <Button variant="outline" size="sm" onClick={() => setCreatingDeadline(true)}>
                <PlusIcon strokeWidth={1.75} /> Nova prova ou prazo
              </Button>
            }
          >
          {upcoming.map((d) => {
            const left = daysUntil(d.due_on, today)
            return (
              <div key={d.id} className="flex min-h-16 items-center gap-4 border-b border-border py-3 last:border-b-0">
                <div className="tabular flex w-14 shrink-0 flex-col items-center">
                  <span className="text-2xl leading-8 font-semibold">{left}</span>
                  <span className="text-[11px] leading-4 tracking-[0.12em] text-muted-foreground uppercase">dias</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] leading-6">{d.title}</span>
                  <span className="text-[13px] leading-5 text-muted-foreground">
                    {format(parseISO(d.due_on), "EEEE, d 'de' MMMM", { locale: ptBR })} · {d.kind === "exam" ? "Prova" : "Entrega"}
                  </span>
                </div>
                {left <= 10 ? <Badge variant="highlight">Em breve</Badge> : null}
              </div>
            )
          })}
          </BentoCard>
          </Bento>
        </TabsContent>
      </Tabs>

      <SubjectDialog
        open={creatingSubject}
        onOpenChange={setCreatingSubject}
        nowIso={nowIso}
        onCreate={(s) => {
          setSubjects((current) => [...current, s])
          toast.success("Matéria criada.")
        }}
      />
      <DeadlineDialog
        open={creatingDeadline}
        onOpenChange={setCreatingDeadline}
        today={today}
        subjects={subjects}
        onCreate={(d) => {
          setDeadlines((current) => [...current, d])
          toast.success("Prazo criado.")
        }}
      />
      <QuizDialog
        deckId={studyDeck}
        cards={cards}
        today={today}
        onClose={() => setStudyDeck(null)}
        onUpdate={(card) => setCards((current) => current.map((c) => (c.id === card.id ? card : c)))}
      />
    </div>
  )
}

// -------------------------------------------------------------- dialogs

function SubjectDialog({
  open,
  onOpenChange,
  nowIso,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nowIso: string
  onCreate: (subject: SubjectRow) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <SubjectForm nowIso={nowIso} onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function SubjectForm({ nowIso, onCreate, onClose }: { nowIso: string; onCreate: (subject: SubjectRow) => void; onClose: () => void }) {
  const [name, setName] = useState("")
  const [type, setType] = useState<SubjectType>("subject")
  const [priority, setPriority] = useState<Priority>("medium")
  const [goal, setGoal] = useState("4")
  const [swatch, setSwatch] = useState<SwatchId>("neutro")

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        onCreate({
          id: mockId("sub"),
          user_id: USER,
          name: name.trim(),
          type,
          priority,
          swatch,
          weekly_goal_min: Math.round((Number(goal.replace(",", ".")) || 1) * 60),
          progress_pct: type === "course" || type === "book" || type === "exam" ? 0 : null,
          progress_label: null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Nova matéria</DialogTitle>
        <DialogDescription className="sr-only">Cadastre uma matéria, curso, livro ou concurso.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sub-name">Nome</Label>
        <Input id="sub-name" autoFocus value={name} maxLength={80} placeholder="Ex.: Direito Administrativo" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sub-type">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as SubjectType)}>
            <SelectTrigger id="sub-type" className="w-full">
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
            <SelectTrigger id="sub-priority" className="w-full">
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="sub-goal">Meta semanal (horas)</Label>
          <Input id="sub-goal" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Cor</Label>
          <SwatchPicker value={swatch} onChange={setSwatch} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          Criar matéria
        </Button>
      </DialogFooter>
    </form>
  )
}

function DeadlineDialog({
  open,
  onOpenChange,
  today,
  subjects,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  today: string
  subjects: SubjectRow[]
  onCreate: (deadline: DeadlineRow) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <DeadlineForm today={today} subjects={subjects} onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function DeadlineForm({
  today,
  subjects,
  onCreate,
  onClose,
}: {
  today: string
  subjects: SubjectRow[]
  onCreate: (deadline: DeadlineRow) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(today)
  const [kind, setKind] = useState<DeadlineRow["kind"]>("exam")
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "")

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return
        onCreate({ id: mockId("dl"), user_id: USER, subject_id: subjectId || null, title: title.trim(), due_on: date, kind })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Nova prova ou prazo</DialogTitle>
        <DialogDescription className="sr-only">Cadastre uma prova ou entrega com data.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="dl-title">Título</Label>
        <Input id="dl-title" autoFocus value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dl-date">Data</Label>
          <Input id="dl-date" type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dl-kind">Tipo</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as DeadlineRow["kind"])}>
            <SelectTrigger id="dl-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exam">Prova</SelectItem>
              <SelectItem value="delivery">Entrega</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="dl-subject">Matéria</Label>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger id="dl-subject" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!title.trim()}>
          Criar
        </Button>
      </DialogFooter>
    </form>
  )
}

function QuizDialog({
  deckId,
  cards,
  today,
  onClose,
  onUpdate,
}: {
  deckId: string | null
  cards: FlashcardRow[]
  today: string
  onClose: () => void
  onUpdate: (card: FlashcardRow) => void
}) {
  return (
    <Dialog open={Boolean(deckId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{deckId ? <QuizBody queue={cards.filter((c) => c.deck_id === deckId && isDue(c, today))} deckName={mockDecks.find((d) => d.id === deckId)?.name ?? ""} today={today} onClose={onClose} onUpdate={onUpdate} /> : null}</DialogContent>
    </Dialog>
  )
}

function QuizBody({
  queue,
  deckName,
  today,
  onClose,
  onUpdate,
}: {
  queue: FlashcardRow[]
  deckName: string
  today: string
  onClose: () => void
  onUpdate: (card: FlashcardRow) => void
}) {
  // The queue is fixed when the quiz opens; answering updates the stored cards.
  const [initial] = useState(queue)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const card = initial[index]

  function answer(rating: Rating) {
    onUpdate(review(card, rating, today))
    setFlipped(false)
    setIndex((i) => i + 1)
  }

  if (!card) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Revisão concluída</DialogTitle>
          <DialogDescription>Você revisou {initial.length} cartões. A próxima revisão é agendada automaticamente.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{deckName}</DialogTitle>
        <DialogDescription className="tabular">
          Cartão {index + 1} de {initial.length}
        </DialogDescription>
      </DialogHeader>
      <Progress value={(index / initial.length) * 100} aria-label="Progresso da revisão" />
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className={cn(
          "flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-border p-6 text-center outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        )}
        aria-label={flipped ? "Mostrar a pergunta" : "Mostrar a resposta"}
      >
        <span className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{flipped ? "Resposta" : "Pergunta"}</span>
        <span className="text-[17px] leading-6 font-medium">{flipped ? card.back : card.front}</span>
        {!flipped ? <span className="text-[13px] leading-5 text-muted-foreground">Toque para ver a resposta</span> : null}
      </button>
      <DialogFooter className="sm:justify-between">
        <Button variant="outline" disabled={!flipped} onClick={() => answer("again")}>
          Errei
        </Button>
        <Button variant="outline" disabled={!flipped} onClick={() => answer("good")}>
          Acertei
        </Button>
        <Button disabled={!flipped} onClick={() => answer("easy")}>
          Fácil
        </Button>
      </DialogFooter>
    </>
  )
}
