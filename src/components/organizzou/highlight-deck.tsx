"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { A11y, EffectCards, Keyboard } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import type { Swiper as SwiperInstance } from "swiper/types"

import { cn } from "@/lib/utils"

import "swiper/css"
import "swiper/css/effect-cards"
import "swiper/css/a11y"

/** A card of the deck. `render` is told whether it is the one in front (that one is Lima, as on Hoje). */
export type DeckSlide = { id: string; render: (front: boolean) => React.ReactNode }

const MAX_DOTS = 7

const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** A window of at most 7 dots around the active one, so 16 cards never become a 16-dot row. */
function dotWindow(count: number, active: number) {
  if (count <= MAX_DOTS) return Array.from({ length: count }, (_, i) => i)
  const start = Math.min(Math.max(0, active - Math.floor(MAX_DOTS / 2)), count - MAX_DOTS)
  return Array.from({ length: MAX_DOTS }, (_, i) => start + i)
}

/** "1 de N" and the dots. */
function Pager({ count, active, onGo, noun }: { count: number; active: number; onGo: (index: number) => void; noun: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 pt-3">
      <p aria-live="polite" className="tabular text-[13px] leading-5 text-muted-foreground">
        {active + 1} de {count}
      </p>
      <div role="tablist" aria-label={`Escolher ${noun}`} className="flex items-center">
        {dotWindow(count, active).map((index) => (
          <button key={index} type="button" role="tab" aria-selected={index === active} aria-label={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${index + 1} de ${count}`} onClick={() => onGo(index)} className="group flex h-11 min-w-6 items-center justify-center outline-none">
            <span
              className={cn(
                "h-2 rounded-full border border-border transition-[width,background-color] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] group-focus-visible:ring-3 group-focus-visible:ring-ring/50 motion-reduce:transition-none",
                index === active ? "w-5 border-transparent bg-highlight" : "w-2 bg-muted"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

type DeckProps = {
  slides: DeckSlide[]
  /** The deck's accessible name ("Destaques do dia"). */
  label: string
  /** The name of the plain strip (reduced motion); defaults to `label`. */
  stripLabel?: string
  /** The singular noun of a card, for the dots ("destaque", "conta", "meta"). */
  noun?: string
  /**
   * A fixed card height in px (Hoje: 172). Without it the deck is as tall as the card in front (measured, animated 0.4 s), so cards of
   * different heights can share one deck; cards behind are cropped to that height.
   */
  height?: number
  /** Height used on the server and until the first measure (adaptive decks). */
  initialHeight?: number
  /** Tailwind width of the deck; the cards behind peek out on both sides. */
  widthClass?: string
  className?: string
}

/**
 * THE card deck of the phones (the "Destaques" of Hoje, and every highlight row of Finanças): the card in front on the normal surface, its neighbors
 * fanned out behind it, "N de M" and dots below, swipe and arrow keys, and (prefers-reduced-motion) a plain strip you scroll sideways.
 */
export function HighlightDeck({ slides, label, stripLabel, noun = "destaque", height, initialHeight = 172, widthClass = "w-[78vw] max-w-[320px]", className }: DeckProps) {
  const reduced = useSyncExternalStore(subscribeReduced, reducedNow, () => false)
  const [swiper, setSwiper] = useState<SwiperInstance | null>(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const go = useCallback((index: number) => swiper?.slideToLoop(index), [swiper])
  const deck = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const [firstSeen, setFirstSeen] = useState(0)
  const adaptive = height === undefined

  // Adaptive: the deck is as tall as the card in front.
  useLayoutEffect(() => {
    const box = deck.current
    if (!adaptive || !box || reduced) return
    const measure = () => {
      const inner = box.querySelector<HTMLElement>(".swiper-slide-active [data-slide-inner]")
      if (inner) box.style.setProperty("--deck-h", `${Math.ceil(inner.offsetHeight)}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    box.querySelectorAll("[data-slide-inner]").forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [adaptive, reduced, active, swiper, slides.length])

  // Flat strip: the first card that is mostly visible is the Lima one.
  useEffect(() => {
    const root = strip.current
    if (!reduced || !root) return
    const visible = new Set<number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index)
          if (entry.isIntersecting) visible.add(index)
          else visible.delete(index)
        }
        if (visible.size > 0) setFirstSeen(Math.min(...visible))
      },
      { root, threshold: 0.6 }
    )
    root.querySelectorAll("[data-index]").forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [reduced, slides.length])

  if (reduced) {
    return (
      <div className={cn("flex flex-col", className)}>
        <div ref={strip} role="region" aria-roledescription="carousel" aria-label={stripLabel ?? label} tabIndex={0} className="no-scrollbar -mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {slides.map((slide, index) => (
            <div key={slide.id} data-index={index} role="group" aria-roledescription="slide" aria-label={`${index + 1} de ${slides.length}`} className={cn("shrink-0 snap-center", widthClass)} style={adaptive ? undefined : { height }}>
              <div className="rounded-[20px]" style={adaptive ? undefined : { height: "100%" }}>
                {slide.render(index === firstSeen)}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col overflow-x-clip", className)}>
      <div ref={deck} style={adaptive ? ({ "--deck-h": `${initialHeight}px` } as React.CSSProperties) : undefined}>
        <Swiper
          modules={[EffectCards, Keyboard, A11y]}
          effect="cards"
          grabCursor
          loop={slides.length > 2}
          keyboard={{ enabled: true, onlyInViewport: true }}
          cardsEffect={{ slideShadows: false, perSlideOffset: 9, perSlideRotate: 2, rotate: true }}
          a11y={{ containerMessage: label, containerRoleDescriptionMessage: "carrossel", itemRoleDescriptionMessage: "item", slideLabelMessage: "{{index}} de {{slidesLength}}", prevSlideMessage: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} anterior`, nextSlideMessage: `Próximo ${noun}` }}
          onSwiper={setSwiper}
          onSlideChange={(s) => {
            activeRef.current = s.realIndex
            setActive(s.realIndex)
          }}
          // A resize (the deck changes height with the card in front) must never throw the deck back to its first card.
          onResize={(s) => {
            if (s.realIndex !== activeRef.current) s.slideToLoop(activeRef.current, 0)
          }}
          className={cn("mx-auto overflow-visible! [&_.swiper-slide]:rounded-[20px]", widthClass, adaptive ? "h-(--deck-h) [&_.swiper-slide]:overflow-hidden [&_.swiper-slide:not(.swiper-slide-active)]:pointer-events-none transition-[height] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none" : "")}
          style={adaptive ? undefined : { height }}
        >
          {slides.map((slide, index) => (
            <SwiperSlide key={slide.id} style={adaptive ? { height: "var(--deck-h)" } : undefined}>
              <div data-slide-inner className={cn("rounded-[20px]", adaptive ? "" : "h-full")}>
                {slide.render(index === active)}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <Pager count={slides.length} active={active} onGo={go} noun={noun} />
    </div>
  )
}
