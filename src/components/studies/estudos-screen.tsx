"use client"

import { useEffect, useState } from "react"
import { format, parseISO, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  BookOpenIcon,
  BookMarkedIcon,
  GraduationCapIcon,
  LibraryIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useRouter } from "next/navigation"

import { BentoCard } from "@/components/organizzou/Bento"
import { HojeTab } from "@/components/studies/estudos-hoje"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { SwatchPicker } from "@/components/organizzou/SwatchPicker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { SplitLayout } from "@/components/organizzou/layout"
import { daysUntil, isDue, review, type Rating } from "@/features/studies/spaced-repetition"
import {
  PRIORITY_LABELS,
  SUBJECT_TYPE_LABELS,
  type DeadlineRow,
  type FlashcardDeckRow,
  type FlashcardRow,
  type Priority,
  type StudySessionRow,
  type SubjectRow,
  type SubjectType,
} from "@/features/studies/types"
import type { SwatchId } from "@/lib/swatches"
import { cn } from "@/lib/utils"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import { dayOf, newId } from "@/lib/sp-time"

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

type TabId = "hoje" | "materias" | "flashcards" | "provas"
const TAB_ITEMS = [
  { id: "hoje", label: "Hoje" },
  { id: "materias", label: "Matérias" },
  { id: "flashcards", label: "Flashcards" },
  { id: "provas", label: "Provas e prazos" },
]

function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

function hours(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`
}

export type StudiesInitial = { subjects: SubjectRow[]; sessions: StudySessionRow[]; deadlines: DeadlineRow[]; decks: FlashcardDeckRow[]; cards: FlashcardRow[] }

export function EstudosScreen({ nowIso, initial }: { nowIso: string; initial: StudiesInitial }) {
  const today = dayOf(nowIso)
  const weekStart = format(startOfWeek(parseISO(today), { weekStartsOn: 1 }), "yyyy-MM-dd")
  const [subjects, setSubjects] = usePersistedRows<SubjectRow>("subjects", initial.subjects)
  const [sessions, setSessions] = usePersistedRows<StudySessionRow>("study_sessions", initial.sessions)
  const [deadlines, setDeadlines] = usePersistedRows<DeadlineRow>("study_deadlines", initial.deadlines)
  const [decks, setDecks] = usePersistedRows<FlashcardDeckRow>("flashcard_decks", initial.decks)
  const [cards, setCards] = usePersistedRows<FlashcardRow>("flashcards", initial.cards)
  const router = useRouter()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<TabId>("hoje")
  const [creatingDeck, setCreatingDeck] = useState(false)
  const [addingCardTo, setAddingCardTo] = useState<FlashcardDeckRow | null>(null)
  const [creatingSubject, setCreatingSubject] = useState(false)
  const [creatingDeadline, setCreatingDeadline] = useState(false)
  const [studyDeck, setStudyDeck] = useState<string | null>(null)
  const [inlineTitle, setInlineTitle] = useState("")
  const [inlineDate, setInlineDate] = useState(today)
  const [editingDeadline, setEditingDeadline] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDate, setEditDate] = useState(today)

  // Pomodoro
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("focus")
  const modeMinutes = MODES.find((m) => m.value === mode)?.minutes ?? 25
  const [remaining, setRemaining] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [chosenSubject, setTimerSubject] = useState("")
  // The chosen subject, or the first one while nothing is chosen (a new account may have none yet: then nothing is recorded).
  const timerSubject = subjects.some((s) => s.id === chosenSubject) ? chosenSubject : (subjects[0]?.id ?? "")

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => window.clearInterval(id)
  }, [running])

  const [finishedHandled, setFinishedHandled] = useState(false)
  if (running && remaining === 0 && !finishedHandled) {
    setFinishedHandled(true)
    setRunning(false)
    if (mode === "focus" && timerSubject) {
      setSessions((current) => [
        ...current,
        { id: newId(), user_id: USER, subject_id: timerSubject, studied_on: today, minutes: modeMinutes, mode: "pomodoro" },
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
    if (!timerSubject) {
      toast("Cadastre uma matéria para registrar o estudo.")
      return
    }
    setSessions((current) => [...current, { id: newId(), user_id: USER, subject_id: timerSubject, studied_on: today, minutes: elapsedMin, mode: "free" }])
    setRunning(false)
    setRemaining(modeMinutes * 60)
    toast.success(`${elapsedMin} min registrados.`)
  }

  // Stats
  const weekMinutes = (subjectId?: string) =>
    sessions.filter((s) => s.studied_on >= weekStart && (!subjectId || s.subject_id === subjectId)).reduce((sum, s) => sum + s.minutes, 0)
  const upcoming = [...deadlines].sort((a, b) => a.due_on.localeCompare(b.due_on))
  const dueCards = cards.filter((c) => isDue(c, today))

  usePrimaryAction("Nova matéria", () => setCreatingSubject(true))

  const tabs = <PillTabs className={isMobile ? "w-full" : "w-fit max-w-full"} ariaLabel="Estudos" items={TAB_ITEMS} value={tab} onSelect={(item) => setTab(item.id as TabId)} />

  return (
    <div className="flex flex-col gap-5">
      <PageHeader />

      {isMobile ? (
        <section aria-label="Estudos" data-testid="estudos-header-block" className="mt-3 flex flex-col gap-2 rounded-[20px] border border-border bg-card p-3">
          <div className="flex h-9 items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-[18px] leading-6 font-semibold">Estudos</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Opções de estudos" data-testid="estudos-options" className="relative size-9 rounded-full after:absolute after:-inset-1">
                  <EllipsisIcon strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setCreatingSubject(true)}>
                  <PlusIcon strokeWidth={1.75} /> Nova matéria
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCreatingDeadline(true)}>
                  <PlusIcon strokeWidth={1.75} /> Nova prova ou prazo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCreatingDeck(true)}>
                  <PlusIcon strokeWidth={1.75} /> Novo baralho
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {tabs}
        </section>
      ) : (
        tabs
      )}

      {tab === "hoje" ? (
        <HojeTab
          subjects={subjects}
          sessions={sessions}
          deadlines={deadlines}
          dueCards={dueCards.length}
          today={today}
          weekStart={weekStart}
          isMobile={isMobile}
          timer={{
            mode,
            modes: MODES,
            onMode: changeMode,
            remaining,
            totalSeconds: modeMinutes * 60,
            running,
            onToggle: toggleTimer,
            onReset: () => {
              setRunning(false)
              setRemaining(modeMinutes * 60)
              setFinishedHandled(false)
            },
            onLog: logElapsed,
            subjectId: timerSubject,
            onSubject: setTimerSubject,
            clock: clock(remaining),
            primaryLabel: running ? "Pausar" : remaining === modeMinutes * 60 ? "Começar" : "Continuar",
          }}
          onReview={() => {
            setTab("flashcards")
            const deck = decks.find((d) => cards.some((c) => c.deck_id === d.id && isDue(c, today)))
            if (deck) setStudyDeck(deck.id)
          }}
          onAllDeadlines={() => setTab("provas")}
          onPlanBlock={() => router.push("/dashboard/agenda")}
          onNewSubject={() => setCreatingSubject(true)}
        />
      ) : null}

        {/* -------------------------------------------------------- subjects */}
      {tab === "materias" ? (<div>
          {subjects.length === 0 ? (
            <EmptyState
              icon={BookOpenIcon}
              title="Nenhuma matéria ainda"
              description="Cadastre o que você estuda (matéria, curso, livro ou concurso) com uma meta semanal. O cronômetro e os gráficos usam isso."
              action={
                <Button className="h-11 rounded-full px-5" onClick={() => setCreatingSubject(true)}>
                  <PlusIcon strokeWidth={1.75} /> Criar a primeira matéria
                </Button>
              }
            />
          ) : null}
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))" }}>
          {subjects.map((s) => {
            const Icon = TYPE_ICONS[s.type]
            const done = weekMinutes(s.id)
            return (
              <BentoCard key={s.id} bodyClassName="flex flex-col gap-3">
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
          </div>
      </div>) : null}

        {/* ------------------------------------------------------ flashcards */}
      {tab === "flashcards" ? (<div>
          <SplitLayout
            aside={
              <BentoCard title="Revisão de hoje" bodyClassName="flex flex-col gap-4">
                <span className="tabular text-[34px] leading-10 font-semibold tracking-[-0.02em]">{dueCards.length}</span>
                <p className="text-[15px] leading-6 text-muted-foreground">{dueCards.length === 0 ? "Nada para revisar hoje." : "cartões para revisar hoje, espalhados pelos baralhos."}</p>
                <Button
                  disabled={dueCards.length === 0}
                  onClick={() => setStudyDeck(decks.find((d) => cards.some((c) => c.deck_id === d.id && isDue(c, today)))?.id ?? null)}
                >
                  Começar a revisão
                </Button>
              </BentoCard>
            }
          >
          <BentoCard
            title="Baralhos"
            actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setCreatingDeck(true)}>
                <PlusIcon strokeWidth={1.75} /> Novo baralho
              </Button>
              <Button size="sm" variant="outline" disabled title="Em breve">
                <SparklesIcon strokeWidth={1.75} /> Gerar com IA (em breve)
              </Button>
            </div>
            }
          >
          <p className="pb-2 text-[15px] leading-6 text-muted-foreground">
            {dueCards.length === 0 ? "Nada para revisar hoje." : `${dueCards.length} cartões para revisar hoje.`}
          </p>
          {decks.length === 0 ? <p className="py-4 text-[15px] leading-6 text-muted-foreground">Nenhum baralho ainda. Crie o primeiro para revisar com repetição espaçada.</p> : null}
          {decks.map((deck) => {
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
                <Button variant="ghost" size="icon" aria-label={`Adicionar cartão em ${deck.name}`} onClick={() => setAddingCardTo(deck)}>
                  <PlusIcon strokeWidth={1.75} />
                </Button>
                <Button variant={due.length > 0 ? "default" : "outline"} disabled={due.length === 0} onClick={() => setStudyDeck(deck.id)}>
                  Estudar
                </Button>
              </div>
            )
          })}
          </BentoCard>
          </SplitLayout>
      </div>) : null}

        {/* --------------------------------------------------------- deadlines */}
      {tab === "provas" ? (<div>
          <BentoCard
            title="Provas e prazos"
            actions={
              <Button variant="outline" size="sm" onClick={() => setCreatingDeadline(true)}>
                <PlusIcon strokeWidth={1.75} /> Nova prova ou prazo
              </Button>
            }
          >
            <form
              className="mb-2 flex flex-wrap items-center gap-2 border-b border-border pb-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!inlineTitle.trim()) return
                setDeadlines((current) => [...current, { id: newId(), user_id: USER, subject_id: subjects[0]?.id ?? null, title: inlineTitle.trim(), due_on: inlineDate, kind: "exam" }])
                setInlineTitle("")
                toast.success("Prazo criado.")
              }}
            >
              <Input value={inlineTitle} onChange={(e) => setInlineTitle(e.target.value)} placeholder="Adicionar prova ou prazo" aria-label="Título da nova prova ou prazo" className="min-w-48 flex-1" />
              <Input type="date" value={inlineDate} min={today} onChange={(e) => setInlineDate(e.target.value)} aria-label="Data" className="w-44" />
              <Button type="submit" disabled={!inlineTitle.trim()}>
                <PlusIcon strokeWidth={1.75} /> Adicionar
              </Button>
            </form>
            {upcoming.map((d) => {
              const left = daysUntil(d.due_on, today)
              const editingThis = editingDeadline === d.id
              return (
                <div key={d.id} className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0">
                  <Badge variant={left <= 10 ? "highlight" : "secondary"} className="h-8 min-w-20 justify-center px-3">
                    {left === 0 ? "Hoje" : `${left} ${left === 1 ? "dia" : "dias"}`}
                  </Badge>
                  {editingThis ? (
                    <form
                      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (!editTitle.trim()) return
                        setDeadlines((current) => current.map((x) => (x.id === d.id ? { ...x, title: editTitle.trim(), due_on: editDate } : x)))
                        setEditingDeadline(null)
                        toast.success("Prazo atualizado.")
                      }}
                    >
                      <Input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label="Título" className="min-w-48 flex-1" />
                      <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} aria-label="Data" className="w-44" />
                      <Button type="submit" size="sm">
                        Salvar
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingDeadline(null)}>
                        Cancelar
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="flex min-w-0 flex-1 basis-48 flex-col">
                        <span className="truncate text-[15px] leading-6">{d.title}</span>
                        <span className="text-[13px] leading-5 text-muted-foreground">
                          {format(parseISO(d.due_on), "EEEE, d 'de' MMMM", { locale: ptBR })} · {d.kind === "exam" ? "Prova" : "Entrega"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${d.title}`}
                        onClick={() => {
                          setEditingDeadline(d.id)
                          setEditTitle(d.title)
                          setEditDate(d.due_on)
                        }}
                      >
                        <PencilIcon strokeWidth={1.75} />
                      </Button>
                    </>
                  )}
                </div>
              )
            })}
          </BentoCard>
      </div>) : null}

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
        decks={decks}
        cards={cards}
        today={today}
        onClose={() => setStudyDeck(null)}
        onUpdate={(card) => setCards((current) => current.map((c) => (c.id === card.id ? card : c)))}
      />
      <Dialog open={creatingDeck} onOpenChange={setCreatingDeck}>
        <DialogContent>
          {creatingDeck ? (
            <DeckForm
              onCreate={(name) => {
                setDecks((current) => [...current, { id: newId(), user_id: USER, subject_id: null, name }])
                toast.success("Baralho criado.")
              }}
              onClose={() => setCreatingDeck(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(addingCardTo)} onOpenChange={(open) => !open && setAddingCardTo(null)}>
        <DialogContent>
          {addingCardTo ? (
            <CardForm
              deck={addingCardTo}
              today={today}
              onCreate={(card) => {
                setCards((current) => [...current, card])
                toast.success("Cartão adicionado.")
              }}
              onClose={() => setAddingCardTo(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DeckForm({ onCreate, onClose }: { onCreate: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("")
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        onCreate(name.trim())
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Novo baralho</DialogTitle>
        <DialogDescription className="sr-only">Dê um nome ao baralho de cartões.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="deck-name">Nome</Label>
        <Input id="deck-name" autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          Criar baralho
        </Button>
      </DialogFooter>
    </form>
  )
}

function CardForm({ deck, today, onCreate, onClose }: { deck: FlashcardDeckRow; today: string; onCreate: (card: FlashcardRow) => void; onClose: () => void }) {
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!front.trim() || !back.trim()) return
        // A new card is due today, with the standard starting ease of the spaced-repetition scheduler.
        onCreate({ id: newId(), deck_id: deck.id, front: front.trim(), back: back.trim(), ease: 2.5, interval_days: 0, repetitions: 0, due_on: today })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Novo cartão</DialogTitle>
        <DialogDescription>{deck.name}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="card-front">Frente (pergunta)</Label>
        <Input id="card-front" autoFocus value={front} maxLength={500} onChange={(e) => setFront(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="card-back">Verso (resposta)</Label>
        <Input id="card-back" value={back} maxLength={500} onChange={(e) => setBack(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!front.trim() || !back.trim()}>
          Adicionar cartão
        </Button>
      </DialogFooter>
    </form>
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
          id: newId(),
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
        onCreate({ id: newId(), user_id: USER, subject_id: subjectId || null, title: title.trim(), due_on: date, kind })
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
  decks,
  cards,
  today,
  onClose,
  onUpdate,
}: {
  deckId: string | null
  decks: FlashcardDeckRow[]
  cards: FlashcardRow[]
  today: string
  onClose: () => void
  onUpdate: (card: FlashcardRow) => void
}) {
  return (
    <Dialog open={Boolean(deckId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{deckId ? <QuizBody queue={cards.filter((c) => c.deck_id === deckId && isDue(c, today))} deckName={decks.find((d) => d.id === deckId)?.name ?? ""} today={today} onClose={onClose} onUpdate={onUpdate} /> : null}</DialogContent>
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
