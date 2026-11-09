"use client"

import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCheckIcon, EllipsisIcon, FlameIcon, LibraryIcon, PlusIcon } from "lucide-react"

import { QuickAdd } from "@/components/organizzou/quick-add"
import { BentoCard, BentoStat } from "@/components/finance/bento"
import { AddPill, HeroCard } from "@/components/finance/parts"
import { HATCH_STYLE } from "@/components/habits/hoje-tab"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { accuracyByDay, averageAccuracy, deckStates, nextDueDate, reviewRecord, reviewStreak, type DayAccuracy, type ReviewLogEntry } from "@/features/studies/review"
import { isDue } from "@/features/studies/spaced-repetition"
import type { FlashcardDeckRow, FlashcardRow } from "@/features/studies/types"
import { cn } from "@/lib/utils"

const chip = "tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const dim = (text: string) => <span className="text-[16px] leading-6 opacity-60">{text}</span>
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

type Props = {
  decks: FlashcardDeckRow[]
  cards: FlashcardRow[]
  log: ReviewLogEntry[]
  today: string
  isMobile: boolean
  onStudyAll: () => void
  onStudyDeck: (deckId: string) => void
  onAddCard: (deck: FlashcardDeckRow) => void
  onCreateDeck: (name: string) => void
  onOpenDeckDialog: () => void
}

// ------------------------------------------------------------------ top row

function AccuracyCard({ days, className }: { days: DayAccuracy[]; className?: string }) {
  const average = averageAccuracy(days)
  const n = days.length
  return (
    <BentoCard title="Acertos · 7 dias" data-testid="flash-accuracy" className={className} actions={<span data-chip className={chip}>{average === null ? "sem revisões" : `média ${average}%`}</span>}>
      <div role="group" aria-label={`Acertos por dia: ${days.map((d) => `${SHORT[parseISO(d.day).getDay()]} ${d.rate === null ? "sem revisão" : `${d.rate}%`}`).join(", ")}`} className="relative h-[132px]">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-5 bottom-6">
          {[0, 50, 100].map((t) => (
            <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${t}%`, transform: "translateY(50%)" }}>
              <span className="tabular w-9 shrink-0 text-right text-[11px] leading-4 text-muted-foreground">{t}%</span>
              <span className={cn("flex-1 border-t", t === 0 ? "border-foreground/35" : "border-dashed border-foreground/20")} />
            </div>
          ))}
        </div>
        <div className="absolute inset-y-0 right-0 flex" style={{ left: 44 }}>
          {days.map((d, i) => {
            const today = i === n - 1
            const has = d.rate !== null
            // A bar is never shorter than it is wide, so a low (or zero) rate still reads as a pill and not as an oval.
            const height = `max(${d.rate ?? 0}%, 28px)`
            return (
              <div key={d.day} data-day={d.day} className="relative h-full min-w-0 flex-1">
                <div className="absolute inset-x-0 top-5 bottom-6 flex justify-center">
                  <div className="relative w-[46%] max-w-5 min-w-3">
                    {has ? <span data-bar={today ? "today" : "past"} className={cn("absolute inset-x-0 bottom-0 rounded-full", today ? "bg-primary" : "border border-foreground/20")} style={{ height, ...(today ? {} : HATCH_STYLE) }} /> : null}
                    {has && today ? (
                      <span className="tabular absolute left-1/2 z-10 -translate-x-1/2 rounded bg-card px-0.5 text-[11px] leading-4 font-semibold" style={{ bottom: `calc(${height} + 4px)` }}>
                        {d.rate}%
                      </span>
                    ) : null}
                  </div>
                </div>
                <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-6 pt-1 text-center text-[11px] leading-5", today ? "font-bold" : "text-muted-foreground")}>
                  {SHORT[parseISO(d.day).getDay()]}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ decks

const MENU_BUTTON = "relative size-9 shrink-0 rounded-full after:absolute after:-inset-y-1 after:inset-x-0"

function DeckCard({ deck, cards, today, onStudy, onAddCard }: { deck: FlashcardDeckRow; cards: FlashcardRow[]; today: string; onStudy: () => void; onAddCard: () => void }) {
  const due = cards.filter((c) => isDue(c, today)).length
  const states = deckStates(cards)
  const total = cards.length
  const legend = [
    { key: "novos", label: "novos", count: states.novos, swatch: "bg-primary" },
    { key: "aprendendo", label: "aprendendo", count: states.aprendendo, swatch: "bg-primary/50" },
    { key: "dominados", label: "dominados", count: states.dominados, swatch: "border border-foreground/30" },
  ] as const
  const bar = (key: (typeof legend)[number]["key"]) =>
    key === "dominados" ? { className: "border border-foreground/20", style: HATCH_STYLE } : { className: key === "novos" ? "bg-primary" : "bg-primary/50", style: undefined }
  return (
    <section aria-label={deck.name} data-deck={deck.id} className="flex h-full min-w-0 flex-col gap-4 rounded-[20px] border border-border bg-card p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border">
          <LibraryIcon strokeWidth={1.75} className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate text-[16px] leading-6 font-semibold">{deck.name}</h3>
          <p className="tabular truncate text-[13px] leading-5 text-muted-foreground">
            {total} {plural(total, "cartão", "cartões")} · {due} para revisar
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={`Opções do baralho ${deck.name}`} className={MENU_BUTTON}>
              <EllipsisIcon strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onAddCard}>
              <PlusIcon strokeWidth={1.75} /> Adicionar cartão
            </DropdownMenuItem>
            <DropdownMenuItem disabled={due === 0} onSelect={onStudy}>
              <LibraryIcon strokeWidth={1.75} /> Estudar agora
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-2.5">
        <div role="img" aria-label={`${deck.name}: ${states.novos} novos, ${states.aprendendo} aprendendo, ${states.dominados} dominados`} data-testid="deck-bar" className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
          {total === 0
            ? null
            : legend.map(({ key, count }) => {
                const b = bar(key)
                return count > 0 ? <span key={key} data-state={key} className={cn("h-full rounded-full", b.className)} style={{ width: `${(count / total) * 100}%`, ...b.style }} /> : null
              })}
        </div>
        <ul className="tabular flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-4 text-muted-foreground">
          {legend.map(({ key, label, count, swatch }) => (
            <li key={key} data-legend={key} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2 rounded-full", swatch)} style={key === "dominados" ? HATCH_STYLE : undefined} />
              {label} <span className="font-semibold text-foreground">{count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex gap-2">
        <Button type="button" data-testid="study-deck" disabled={due === 0} onClick={onStudy} className="h-11 min-w-0 flex-1 rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/90">
          Estudar
        </Button>
        <Button type="button" variant="outline" onClick={onAddCard} className="h-11 rounded-full px-4">
          <PlusIcon strokeWidth={1.75} /> Cartão
        </Button>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ the tab

export function FlashcardsTab({ decks, cards, log, today, isMobile, onStudyAll, onStudyDeck, onAddCard, onCreateDeck, onOpenDeckDialog }: Props) {
  const due = cards.filter((c) => isDue(c, today))
  const next = nextDueDate(cards, today)
  const days = accuracyByDay(log, today, 7)
  const streak = reviewStreak(log, today)
  const record = Math.max(reviewRecord(log), streak)
  const upToDate = due.length === 0

  const hero = (
    <HeroCard
      className="h-48 @min-[880px]:col-span-5"
      density="dense"
      label="Revisão de hoje"
      value={
        <>
          {due.length} {dim(due.length === 1 ? "cartão" : "cartões")}
        </>
      }
      support={upToDate ? (cards.length === 0 ? "Nenhum cartão ainda" : next ? `Tudo em dia · próxima revisão em ${format(parseISO(next), "d 'de' MMM", { locale: ptBR }).replace(".", "")}` : "Tudo em dia") : "espalhados pelos baralhos"}
      actions={
        upToDate ? (
          <span data-testid="all-clear" className="mt-auto inline-flex h-10 w-fit items-center gap-2 text-[14px] font-semibold">
            <CheckCheckIcon aria-hidden strokeWidth={1.75} className="size-4" /> Tudo em dia
          </span>
        ) : (
          <Button type="button" data-testid="study-all" onClick={onStudyAll} className="mt-auto h-10 w-fit rounded-full bg-highlight-foreground px-4 text-highlight hover:bg-highlight-foreground/90">
            Começar a revisão
          </Button>
        )
      }
    />
  )
  const accuracy = <AccuracyCard days={days} className="h-48 @min-[880px]:col-span-4" />
  const streakCard = (
    <BentoStat label="Sequência de revisão" icon={FlameIcon} className="h-48 @min-[880px]:col-span-3" chip={`recorde: ${record} ${record === 1 ? "dia" : "dias"}`}>
      {streak} {dim(streak === 1 ? "dia" : "dias")}
    </BentoStat>
  )

  return (
    <div data-testid="estudos-flashcards" className="@container flex min-w-0 flex-col gap-4">
      <QuickAdd label="Novo baralho… ex.: Direito Penal — princípios" shortLabel="Novo baralho…" ariaLabel="Nome do novo baralho" isMobile={isMobile} onSubmit={(name) => (name ? onCreateDeck(name) : onOpenDeckDialog())} />
      <div className="grid grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
        {hero}
        {accuracy}
        {streakCard}
      </div>
      {decks.length === 0 ? (
        <div data-testid="no-decks" className="flex flex-col items-center gap-3 rounded-[20px] border border-border p-8 text-center">
          <LibraryIcon aria-hidden strokeWidth={1.75} className="size-7 text-muted-foreground" />
          <p className="text-[15px] leading-6 font-medium">Nenhum baralho ainda</p>
          <p className="max-w-80 text-[13px] leading-5 text-muted-foreground">Crie o primeiro para revisar com repetição espaçada.</p>
          <AddPill label="Criar o primeiro baralho" onClick={onOpenDeckDialog} className="max-w-72" />
        </div>
      ) : (
        <div data-testid="deck-grid" className="grid grid-cols-1 gap-4 @min-[720px]:grid-cols-2">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} cards={cards.filter((c) => c.deck_id === deck.id)} today={today} onStudy={() => onStudyDeck(deck.id)} onAddCard={() => onAddCard(deck)} />
          ))}
        </div>
      )}
    </div>
  )
}
