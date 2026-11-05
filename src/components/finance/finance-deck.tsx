"use client"

import { HighlightDeck, type DeckSlide } from "@/components/organizzou/highlight-deck"
import { SectionHeader } from "@/components/organizzou/SectionHeader"
import { cn } from "@/lib/utils"

/**
 * The card in front is Lima, as on Hoje. The Finanças cards are written for the dark/light card surface, so the front card is recolored by
 * re-pointing the tokens they already use (card, foreground, muted, border, primary…) to Lima and Tinta; nothing inside them knows.
 */
const LIMA =
  "text-foreground [--background:var(--highlight)] [--card:var(--highlight)] [--card-foreground:var(--highlight-foreground)] [--foreground:var(--highlight-foreground)] [--border:color-mix(in_oklab,var(--highlight-foreground)_22%,transparent)] [--input:color-mix(in_oklab,var(--highlight-foreground)_22%,transparent)] [--muted:color-mix(in_oklab,var(--highlight-foreground)_12%,transparent)] [--muted-foreground:color-mix(in_oklab,var(--highlight-foreground)_72%,transparent)] [--accent:color-mix(in_oklab,var(--highlight-foreground)_10%,transparent)] [--primary:var(--highlight-foreground)] [--primary-foreground:var(--highlight)]"

/** The Lima hero card of a screen, when it is NOT in front, becomes a normal card: its Lima is re-pointed to the card surface. */
const SURFACE = "[--highlight:var(--card)] [--highlight-foreground:var(--foreground)] [&_[data-hero-card]]:border-border"

export type FinanceSlide = {
  id: string
  /** A card that is already Lima (the HeroCard): it is the one that turns into a surface card when it is behind. */
  hero?: boolean
  node: React.ReactNode
}

/** "Destaques" of a Finanças tab on phones: the shared deck with this tab's cards, one Lima in front. */
export function FinanceDeck({ slides, label = "Destaques", noun = "destaque", initialHeight = 168, title = "Destaques", widthClass = "w-[78vw] max-w-[320px]", className }: { slides: FinanceSlide[]; label?: string; noun?: string; initialHeight?: number; title?: string | null; widthClass?: string; className?: string }) {
  const deck: DeckSlide[] = slides.map((slide) => ({
    id: slide.id,
    render: (front) => <div className={cn("h-full", front ? (slide.hero ? "" : LIMA) : slide.hero ? SURFACE : "")}>{slide.node}</div>,
  }))
  return (
    <section aria-label={label} data-testid="finance-deck" className={cn("flex min-w-0 flex-col gap-1", className)}>
      {title ? <SectionHeader title={title} className="min-h-9" /> : null}
      <HighlightDeck slides={deck} label={label} noun={noun} initialHeight={initialHeight} widthClass={widthClass} />
    </section>
  )
}
