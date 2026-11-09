"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCheckIcon, XIcon } from "lucide-react"

import { HatchedProgress } from "@/components/finance/parts"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StickyFooter } from "@/components/workouts/sheet-fields"
import { useIsMobile } from "@/hooks/use-mobile"
import { intervalLabel } from "@/features/studies/review"
import { review, type Rating } from "@/features/studies/spaced-repetition"
import type { FlashcardRow, FlashcardDeckRow } from "@/features/studies/types"
import { cn } from "@/lib/utils"
import { newId } from "@/lib/sp-time"

const LIMA_BUTTON = "bg-highlight text-highlight-foreground hover:bg-highlight/90"
const area = "min-h-24 rounded-[12px] px-3 py-2.5 text-[15px] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"

// ------------------------------------------------------------------ new card

/** "Novo cartão": a dialog on desktop, a bottom sheet on phones. Ctrl/Cmd + Enter saves and opens a new card. */
export function CardSheet({ deck, today, onClose, onAdd }: { deck: FlashcardDeckRow | null; today: string; onClose: () => void; onAdd: (card: FlashcardRow) => void }) {
  return (
    <ResponsiveSheet open={Boolean(deck)} onOpenChange={(open) => !open && onClose()} title="Novo cartão" description={deck?.name}>
      {deck ? <CardForm deck={deck} today={today} onAdd={onAdd} onClose={onClose} /> : null}
    </ResponsiveSheet>
  )
}

function CardForm({ deck, today, onAdd, onClose }: { deck: FlashcardDeckRow; today: string; onAdd: (card: FlashcardRow) => void; onClose: () => void }) {
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")
  const frontRef = useRef<HTMLTextAreaElement>(null)
  const valid = front.trim() !== "" && back.trim() !== ""

  function save(another: boolean) {
    if (!valid) return
    // A new card is due today, with the standard starting ease of the spaced-repetition scheduler.
    onAdd({ id: newId(), deck_id: deck.id, front: front.trim(), back: back.trim(), ease: 2.5, interval_days: 0, repetitions: 0, due_on: today })
    if (another) {
      setFront("")
      setBack("")
      frontRef.current?.focus()
    } else onClose()
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault()
      save(true)
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        save(false)
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="card-front">Frente (pergunta)</Label>
        <Textarea id="card-front" ref={frontRef} autoFocus value={front} maxLength={500} onChange={(e) => setFront(e.target.value)} onKeyDown={onKeyDown} className={area} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="card-back">Verso (resposta)</Label>
        <Textarea id="card-back" value={back} maxLength={2000} onChange={(e) => setBack(e.target.value)} onKeyDown={onKeyDown} className={area} />
        <p data-testid="card-hint" className="text-[13px] leading-5 text-muted-foreground pointer-coarse:hidden">
          Dica: Ctrl + Enter salva e abre um novo cartão.
        </p>
      </div>
      <StickyFooter className="max-md:flex-wrap max-md:[&>*]:basis-[calc(50%-0.25rem)]">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" variant="outline" disabled={!valid} onClick={() => save(true)}>
          Salvar e criar outro
        </Button>
        <Button type="submit" disabled={!valid} className={cn(LIMA_BUTTON, "max-md:order-first max-md:basis-full!")}>
          Adicionar cartão
        </Button>
      </StickyFooter>
    </form>
  )
}

// ------------------------------------------------------------------ review

export type ReviewSheetProps = {
  /** The cards to review (fixed when the review opens), or null when closed. */
  queue: FlashcardRow[] | null
  title: string
  /** When the queue mixes decks, the deck of a card is shown on it. */
  deckName?: (card: FlashcardRow) => string
  today: string
  onAnswer: (card: FlashcardRow, rating: Rating) => void
  onClose: () => void
}

/** The review: a dialog on desktop, a (nearly) full-height sheet on phones. Space flips, 1/2/3 answers. */
export function ReviewSheet(props: ReviewSheetProps) {
  const isMobile = useIsMobile()
  const open = Boolean(props.queue)
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && props.onClose()}>
        <DrawerContent className="h-[94dvh] max-h-[94dvh]">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{props.queue ? <ReviewBody {...props} queue={props.queue} Title={DrawerTitle} Description={DrawerDescription} /> : null}</div>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent showCloseButton={false} className="flex max-h-[90dvh] flex-col rounded-[20px] sm:max-w-xl">
        {props.queue ? <ReviewBody {...props} queue={props.queue} Title={DialogTitle} Description={DialogDescription} /> : null}
      </DialogContent>
    </Dialog>
  )
}

const RATINGS: { rating: Rating; label: string; key: string }[] = [
  { rating: "again", label: "Errei", key: "1" },
  { rating: "good", label: "Acertei", key: "2" },
  { rating: "easy", label: "Fácil", key: "3" },
]

function ReviewBody({ queue, title, deckName, today, onAnswer, onClose, Title, Description }: Omit<ReviewSheetProps, "queue"> & { queue: FlashcardRow[]; Title: React.ElementType; Description: React.ElementType }) {
  // The queue is fixed when the review opens; answering updates the stored cards.
  const [initial] = useState(queue)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [hits, setHits] = useState(0)
  const card = initial[index]
  const cardRef = useRef<HTMLDivElement>(null)

  function answer(rating: Rating) {
    if (!card) return
    onAnswer(card, rating)
    if (rating !== "again") setHits((h) => h + 1)
    setFlipped(false)
    setIndex((i) => i + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !card) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === " ") {
        // A focused button keeps its own Space; anywhere else Space flips the card.
        if (tag === "BUTTON") return
        e.preventDefault()
        setFlipped((f) => !f)
        return
      }
      const chosen = RATINGS.find((r) => r.key === e.key)
      if (chosen && flipped) answer(chosen.rating)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  useEffect(() => {
    cardRef.current?.focus()
  }, [index])

  const header = (heading: string, sub: string) => (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Title className="truncate text-[17px] leading-6 font-semibold">{heading}</Title>
        <Description className="tabular text-[13px] leading-5 text-muted-foreground">{sub}</Description>
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label="Fechar a revisão" onClick={onClose} className="relative size-10 shrink-0 rounded-full after:absolute after:-inset-1">
        <XIcon strokeWidth={1.75} />
      </Button>
    </div>
  )

  if (!card) {
    return (
      <div data-testid="review-done" className="flex min-h-0 flex-1 flex-col gap-6 pt-2">
        {header("Revisão concluída", `${initial.length} ${initial.length === 1 ? "cartão revisado" : "cartões revisados"}`)}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[20px] border border-border p-8 text-center">
          <CheckCheckIcon aria-hidden strokeWidth={1.75} className="size-8" />
          <p className="text-[17px] leading-6 font-semibold">Tudo em dia por agora</p>
          <p className="tabular text-[13px] leading-5 text-muted-foreground">
            {hits} de {initial.length} {initial.length === 1 ? "acerto" : "acertos"}. A próxima revisão é agendada automaticamente.
          </p>
        </div>
        <Button type="button" onClick={onClose} className={cn(LIMA_BUTTON, "h-12 rounded-full")}>
          Fechar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pt-2">
      {header(title, `Cartão ${index + 1} de ${initial.length}`)}
      <HatchedProgress value={(index / initial.length) * 100} label="Progresso da revisão" />
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        data-testid="review-card"
        data-flipped={flipped}
        aria-label={flipped ? "Mostrar a pergunta" : "Mostrar a resposta"}
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-56 flex-1 cursor-pointer flex-col items-center justify-center gap-3 overflow-y-auto rounded-[20px] border border-border bg-card p-6 text-center outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
      >
        <span className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{flipped ? "Resposta" : "Pergunta"}</span>
        {deckName ? <span className="text-[12px] leading-4 text-muted-foreground">{deckName(card)}</span> : null}
        <span className="text-[22px] leading-8 font-medium break-words whitespace-pre-wrap">{flipped ? card.back : card.front}</span>
        {!flipped ? <span className="text-[13px] leading-5 text-muted-foreground">Toque ou use Espaço para ver a resposta</span> : null}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {RATINGS.map(({ rating, label, key }) => (
          <div key={rating} className="flex min-w-0 flex-col items-center gap-1.5">
            <Button type="button" data-rating={rating} aria-keyshortcuts={key} disabled={!flipped} variant={rating === "easy" ? "default" : "outline"} onClick={() => answer(rating)} className={cn("h-12 w-full rounded-full text-[15px]", rating === "easy" && LIMA_BUTTON)}>
              {label}
            </Button>
            {/* The interval comes from the scheduler itself (review), the label only formats it. */}
            <span data-interval={rating} className="tabular text-[12px] leading-4 text-muted-foreground">
              {intervalLabel(review(card, rating, today).interval_days)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
