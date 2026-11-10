"use client"

import { useEffect, useState } from "react"
import { format, parseISO, startOfWeek } from "date-fns"
import {
  EllipsisIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useRouter } from "next/navigation"

import { DeadlineSheet, type DeadlineDraft } from "@/components/studies/deadline-sheet"
import { FlashcardsTab } from "@/components/studies/estudos-flashcards"
import { HojeTab } from "@/components/studies/estudos-hoje"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { MateriasTab } from "@/components/studies/estudos-materias"
import { SubjectSheet } from "@/components/studies/subject-sheet"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { fieldClass, StickyFooter } from "@/components/workouts/sheet-fields"
import { useRestoreFocus } from "@/hooks/use-restore-focus"
import { localSubjectMetaRepo, setArchived, type SubjectMeta } from "@/features/studies/subject-meta"
import { ProvasTab } from "@/components/studies/estudos-provas"
import { localDeadlineMetaRepo, typeOf, type DeadlineMetaMap } from "@/features/studies/deadlines"
import { CardSheet, ReviewSheet } from "@/components/studies/flashcard-dialogs"
import { localReviewLogRepo, type ReviewLogEntry } from "@/features/studies/review"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { isDue, review, type Rating } from "@/features/studies/spaced-repetition"
import {
  type DeadlineRow,
  type FlashcardDeckRow,
  type FlashcardRow,
  type StudySessionRow,
  type SubjectRow,
} from "@/features/studies/types"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import { dayOf, newId } from "@/lib/sp-time"

const USER = "00000000-0000-4000-8000-000000000001"
const MODES = [
  { value: "focus", label: "Foco", minutes: 25 },
  { value: "short", label: "Pausa", minutes: 5 },
  { value: "long", label: "Pausa longa", minutes: 15 },
] as const

const blankDraft = (today: string): DeadlineDraft => ({ title: "", date: today, type: "exam", subjectId: "", remind: [] })
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

export type StudiesInitial = { subjects: SubjectRow[]; sessions: StudySessionRow[]; deadlines: DeadlineRow[]; decks: FlashcardDeckRow[]; cards: FlashcardRow[] }

export function EstudosScreen({ nowIso, initial }: { nowIso: string; initial: StudiesInitial }) {
  const today = dayOf(nowIso)
  const weekStart = format(startOfWeek(parseISO(today), { weekStartsOn: 1 }), "yyyy-MM-dd")
  const [allSubjects, setSubjects] = usePersistedRows<SubjectRow>("subjects", initial.subjects)
  // Archived subjects leave the timer, the deadlines and the charts but keep their history (the flag lives in localStorage until subjects has a column: see subject-meta.ts).
  const [subjectMeta, setSubjectMeta] = useState<SubjectMeta>({ archived: [] })
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubjectMeta(localSubjectMetaRepo.load())
  }, [])
  const subjects = allSubjects.filter((s) => !subjectMeta.archived.includes(s.id))
  const [subjectSheet, setSubjectSheet] = useState<{ subject: SubjectRow | null } | null>(null)
  const [deletingSubject, setDeletingSubject] = useState<SubjectRow | null>(null)
  function archiveSubject(subject: SubjectRow, archived: boolean) {
    setSubjectMeta((current) => {
      const next = setArchived(current, subject.id, archived)
      localSubjectMetaRepo.save(next)
      return next
    })
    toast.success(archived ? "Matéria arquivada." : "Matéria restaurada.")
  }
  const [sessions, setSessions] = usePersistedRows<StudySessionRow>("study_sessions", initial.sessions)
  const [deadlines, setDeadlines] = usePersistedRows<DeadlineRow>("study_deadlines", initial.deadlines)
  const [decks, setDecks] = usePersistedRows<FlashcardDeckRow>("flashcard_decks", initial.decks)
  const [cards, setCards] = usePersistedRows<FlashcardRow>("flashcards", initial.cards)
  const router = useRouter()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<TabId>("hoje")
  const [reviewLog, setReviewLog] = useState<ReviewLogEntry[]>([])
  useEffect(() => {
    // localStorage only exists in the browser; read after mount so the server and the first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReviewLog(localReviewLogRepo.load())
  }, [])
  const [creatingDeck, setCreatingDeck] = useState(false)
  // The creation rows open these from state (no Radix trigger), so focus is handed back to the row when they close.
  useRestoreFocus(creatingDeck)
  const [addingCardTo, setAddingCardTo] = useState<FlashcardDeckRow | null>(null)
  const [deadlineDraft, setDeadlineDraft] = useState<DeadlineDraft | null>(null)
  useRestoreFocus(deadlineDraft !== null)
  const [metas, setMetas] = useState<DeadlineMetaMap>({})
  useEffect(() => {
    // localStorage only exists in the browser; read after mount so the server and the first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMetas(localDeadlineMetaRepo.load())
  }, [])
  const [studyDeck, setStudyDeck] = useState<string | null>(null)

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
  const dueCards = cards.filter((c) => isDue(c, today))

  usePrimaryAction("Nova matéria", () => setSubjectSheet({ subject: null }))

  const updateMetas = (change: (current: DeadlineMetaMap) => DeadlineMetaMap) =>
    setMetas((current) => {
      const next = change(current)
      localDeadlineMetaRepo.save(next)
      return next
    })


  function editDeadline(row: DeadlineRow) {
    const meta = metas[row.id]
    setDeadlineDraft({ id: row.id, title: row.title, date: row.due_on, type: typeOf(row, meta), subjectId: row.subject_id ?? "", remind: meta?.remind ?? [] })
  }

  function saveDeadline(draft: DeadlineDraft) {
    // "Outro" has no value in the saved kind yet: it is stored as a Prova plus a local flag (see deadlines.ts).
    const kind: DeadlineRow["kind"] = draft.type === "delivery" ? "delivery" : "exam"
    const id = draft.id ?? newId()
    if (draft.id) setDeadlines((current) => current.map((d) => (d.id === id ? { ...d, title: draft.title, due_on: draft.date, kind, subject_id: draft.subjectId || null } : d)))
    else setDeadlines((current) => [...current, { id, user_id: USER, subject_id: draft.subjectId || null, title: draft.title, due_on: draft.date, kind }])
    updateMetas((current) => ({ ...current, [id]: { ...current[id], other: draft.type === "other" || undefined, remind: draft.remind.length > 0 ? draft.remind : undefined } }))
    toast.success(draft.id ? "Prazo atualizado." : "Prazo criado.")
  }

  function toggleDeadlineDone(row: DeadlineRow) {
    const done = !metas[row.id]?.done
    updateMetas((current) => ({ ...current, [row.id]: { ...current[row.id], done: done || undefined } }))
    toast(done ? "Prazo concluído." : "Prazo reaberto.")
  }

  function deleteDeadline(row: DeadlineRow) {
    setDeadlines((current) => current.filter((d) => d.id !== row.id))
    updateMetas((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== row.id)))
    toast("Prazo excluído.")
  }

  function createDeck(name: string) {
    setDecks((current) => [...current, { id: newId(), user_id: USER, subject_id: null, name }])
    toast.success("Baralho criado.")
  }

  /** Schedules the card with the unchanged algorithm and records the answer in the review history. */
  function answerCard(card: FlashcardRow, rating: Rating) {
    setCards((current) => current.map((c) => (c.id === card.id ? review(card, rating, today) : c)))
    setReviewLog((current) => {
      const next = [...current, { id: newId(), card_id: card.id, deck_id: card.deck_id, reviewed_on: today, rating }]
      localReviewLogRepo.save(next)
      return next
    })
  }

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
                <DropdownMenuItem onSelect={() => setSubjectSheet({ subject: null })}>
                  <PlusIcon strokeWidth={1.75} /> Nova matéria
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDeadlineDraft(blankDraft(today))}>
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
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {tabs}
          {tab === "flashcards" ? (
            <Button type="button" variant="ghost" disabled aria-disabled="true" data-testid="ai-soon" className="h-9 rounded-full px-4 opacity-55">
              <SparklesIcon strokeWidth={1.75} /> Gerar com IA · em breve
            </Button>
          ) : null}
        </div>
      )}

      {tab === "hoje" ? (
        <HojeTab
          subjects={subjects}
          sessions={sessions}
          deadlines={deadlines.filter((d) => !metas[d.id]?.done)}
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
            if (dueCards.length > 0) setStudyDeck("all")
          }}
          onAllDeadlines={() => setTab("provas")}
          onPlanBlock={() => router.push("/dashboard/agenda")}
          onNewSubject={() => setSubjectSheet({ subject: null })}
        />
      ) : null}

        {/* -------------------------------------------------------- subjects */}
      {tab === "materias" ? <MateriasTab subjects={allSubjects} archivedIds={subjectMeta.archived} weekMinutes={weekMinutes} isMobile={isMobile} onNew={() => setSubjectSheet({ subject: null })} onEdit={(s) => setSubjectSheet({ subject: s })} onArchive={archiveSubject} onDelete={setDeletingSubject} /> : null}

        {/* ------------------------------------------------------ flashcards */}
      {tab === "flashcards" ? (
        <FlashcardsTab
          decks={decks}
          cards={cards}
          log={reviewLog}
          today={today}
          isMobile={isMobile}
          onStudyAll={() => setStudyDeck("all")}
          onStudyDeck={setStudyDeck}
          onAddCard={setAddingCardTo}
          onOpenDeckDialog={() => setCreatingDeck(true)}
        />
      ) : null}

        {/* --------------------------------------------------------- deadlines */}
      {tab === "provas" ? (
        <ProvasTab
          deadlines={deadlines}
          subjects={subjects}
          metas={metas}
          today={today}
          isMobile={isMobile}
          onNew={() => setDeadlineDraft(blankDraft(today))}
          onEdit={editDeadline}
          onToggleDone={toggleDeadlineDone}
          onDelete={deleteDeadline}
        />
      ) : null}

      <SubjectSheet
        open={subjectSheet !== null}
        subject={subjectSheet?.subject ?? null}
        nowIso={nowIso}
        userId={USER}
        onClose={() => setSubjectSheet(null)}
        onSave={(s) => {
          const isNew = !allSubjects.some((x) => x.id === s.id)
          setSubjects((current) => (isNew ? [...current, s] : current.map((x) => (x.id === s.id ? s : x))))
          toast.success(isNew ? "Matéria criada." : "Matéria salva.")
        }}
      />
      <ConfirmDialog
        open={Boolean(deletingSubject)}
        onOpenChange={(o) => !o && setDeletingSubject(null)}
        title={deletingSubject ? `Excluir “${deletingSubject.name}”?` : "Excluir matéria?"}
        description="Os registros de estudo dessa matéria também serão apagados. Para guardá-la sem apagar nada, arquive."
        onConfirm={() => {
          const target = deletingSubject
          setDeletingSubject(null)
          if (!target) return
          setSubjects((current) => current.filter((x) => x.id !== target.id))
          toast.success("Matéria excluída.")
        }}
      />
      <DeadlineSheet draft={deadlineDraft} today={today} subjects={subjects} onClose={() => setDeadlineDraft(null)} onSave={saveDeadline} />
      <ReviewSheet
        queue={studyDeck ? cards.filter((c) => (studyDeck === "all" || c.deck_id === studyDeck) && isDue(c, today)) : null}
        title={studyDeck === "all" ? "Revisão de hoje" : (decks.find((d) => d.id === studyDeck)?.name ?? "")}
        deckName={studyDeck === "all" ? (card) => decks.find((d) => d.id === card.deck_id)?.name ?? "" : undefined}
        today={today}
        onAnswer={answerCard}
        onClose={() => setStudyDeck(null)}
      />
<ResponsiveSheet open={creatingDeck} onOpenChange={setCreatingDeck} title="Novo baralho" description="Dê um nome ao baralho de cartões.">        {creatingDeck ? <DeckForm onCreate={createDeck} onClose={() => setCreatingDeck(false)} /> : null}      </ResponsiveSheet>
      <CardSheet
        deck={addingCardTo}
        today={today}
        onClose={() => setAddingCardTo(null)}
        onAdd={(card) => {
          setCards((current) => [...current, card])
          toast.success("Cartão adicionado.")
        }}
      />
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="deck-name">Nome</Label>
        <Input id="deck-name" autoFocus value={name} maxLength={100} placeholder="Ex.: Direito Penal — princípios" autoComplete="off" onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!name.trim()} className="bg-highlight text-highlight-foreground hover:bg-highlight/90">
          Criar baralho
        </Button>
      </StickyFooter>
    </form>
  )
}
