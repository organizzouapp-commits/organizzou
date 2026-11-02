"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { A11y, EffectCards, Keyboard } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import type { Swiper as SwiperInstance } from "swiper/types"

import { Button } from "@/components/ui/button"
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

import { StatToneProvider } from "./stat-card"

import "swiper/css"
import "swiper/css/effect-cards"
import "swiper/css/a11y"

export type HighlightItem = { id: string; node: React.ReactNode }

/** Exactly one card is Lima: the one in front. Everything else is the normal card surface. */
const toneOf = (index: number, front: number) => (index === front ? ("highlight" as const) : ("default" as const))

const GAP = 16
const MIN_CARD = 240
const MAX_CARD = 320

const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

// ---------------------------------------------------------------------------------------------------------------------
// ≥ 768 px: one row, as many cards as fit (240–320 px each, equal height), prev/next arrows and drag/trackpad scroll.

function DesktopRow({ items, onApi }: { items: HighlightItem[]; onApi: (api: CarouselApi) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(280)
  const [api, setApi] = useState<CarouselApi>()
  // The Lima card is the first one in view at the left edge. The server renders card 0, so nothing flashes on load.
  const [front, setFront] = useState(0)

  useEffect(() => {
    if (!api) return
    const sync = () => {
      const inView = api.slidesInView()
      setFront(inView.length > 0 ? Math.min(...inView) : api.selectedScrollSnap())
    }
    sync()
    api.on("select", sync).on("settle", sync).on("reInit", sync).on("slidesInView", sync)
    return () => {
      api.off("select", sync).off("settle", sync).off("reInit", sync).off("slidesInView", sync)
    }
  }, [api])

  // Card width from the room the row really has (it sits next to the sidebar, so the viewport width is no guide).
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const available = el.clientWidth
      const fit = Math.max(1, Math.floor((available + GAP) / (MIN_CARD + GAP)))
      const columns = Math.min(items.length, fit)
      setWidth(Math.max(MIN_CARD, Math.min(MAX_CARD, Math.floor((available - GAP * (columns - 1)) / columns))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [items.length])

  return (
    <div ref={box} className="min-w-0">
      <Carousel
        opts={{ align: "start", dragFree: true, containScroll: "trimSnaps", skipSnaps: true, inViewThreshold: 0.6 }}
        setApi={(next) => {
          setApi(next)
          onApi(next)
        }} aria-label="Destaques"
        className="w-full"
      >
        <CarouselContent className="ml-0 touch-pan-y gap-4">
          {items.map((item, index) => (
            <CarouselItem key={item.id} aria-label={`${index + 1} de ${items.length}`} className="pl-0" style={{ flex: `0 0 ${width}px` }}>
              <StatToneProvider tone={toneOf(index, front)}>
                <div className="h-full rounded-[24px]">{item.node}</div>
              </StatToneProvider>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  )
}

/** Prev/next in the "DESTAQUES" row. Hidden when every card fits. */
export function HighlightArrows({ api }: { api: CarouselApi | undefined }) {
  const [state, setState] = useState({ prev: false, next: false })
  useEffect(() => {
    if (!api) return
    const update = () => setState({ prev: api.canScrollPrev(), next: api.canScrollNext() })
    update()
    api.on("select", update).on("reInit", update).on("scroll", update)
    return () => {
      api.off("select", update).off("reInit", update).off("scroll", update)
    }
  }, [api])
  if (!api || (!state.prev && !state.next)) return null
  return (
    <div className="hidden items-center gap-2 md:flex">
      <Button type="button" size="icon" className="size-11 rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/85 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50" aria-label="Destaques anteriores" disabled={!state.prev} onClick={() => api.scrollPrev()}>
        <ChevronLeftIcon strokeWidth={1.75} />
      </Button>
      <Button type="button" size="icon" className="size-11 rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/85 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50" aria-label="Próximos destaques" disabled={!state.next} onClick={() => api.scrollNext()}>
        <ChevronRightIcon strokeWidth={1.75} />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// < 768 px: stacked cards (Swiper EffectCards). The active card is on top with the normal card surface, the others fan out behind
// it; slide shadows are off (no shadows on dark) and the surfaces and 1 px borders keep them apart.

const MAX_DOTS = 7

/** A window of at most 7 dots around the active one, so 16 cards never become a 16-dot row. */
function dotWindow(count: number, active: number) {
  if (count <= MAX_DOTS) return Array.from({ length: count }, (_, i) => i)
  const start = Math.min(Math.max(0, active - Math.floor(MAX_DOTS / 2)), count - MAX_DOTS)
  return Array.from({ length: MAX_DOTS }, (_, i) => start + i)
}

function Pager({ count, active, onGo }: { count: number; active: number; onGo: (index: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5 pt-3">
      <p aria-live="polite" className="tabular text-[13px] leading-5 text-muted-foreground">
        {active + 1} de {count}
      </p>
      <div role="tablist" aria-label="Escolher destaque" className="flex items-center">
        {dotWindow(count, active).map((index) => (
          <button key={index} type="button" role="tab" aria-selected={index === active} aria-label={`Destaque ${index + 1} de ${count}`} onClick={() => onGo(index)} className="group flex h-11 min-w-6 items-center justify-center outline-none">
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

/** The deck is a fixed 78vw (max 320 px) by 172 px box, so server HTML and client render have the same size: no layout jump. */
const deckBox = "mx-auto h-[172px] w-[78vw] max-w-[320px]"

function CardsDeck({ items }: { items: HighlightItem[] }) {
  const reduced = useSyncExternalStore(subscribeReduced, reducedNow, () => false)
  const [swiper, setSwiper] = useState<SwiperInstance | null>(null)
  const [active, setActive] = useState(0)
  const go = useCallback((index: number) => swiper?.slideToLoop(index), [swiper])
  const strip = useRef<HTMLDivElement>(null)
  const [firstSeen, setFirstSeen] = useState(0)

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
  }, [reduced, items.length])

  if (reduced) {
    // prefers-reduced-motion: a plain strip you scroll sideways, no 3D, no stacking.
    return (
      <div className="flex flex-col">
        <div ref={strip} role="region" aria-roledescription="carousel" aria-label="Destaques" tabIndex={0} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {items.map((item, index) => (
            <div key={item.id} data-index={index} role="group" aria-roledescription="slide" aria-label={`${index + 1} de ${items.length}`} className="h-[172px] w-[78vw] max-w-[320px] shrink-0 snap-center">
              <StatToneProvider tone={toneOf(index, firstSeen)}>
                <div className="h-full rounded-[20px]">{item.node}</div>
              </StatToneProvider>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-x-clip">
      <Swiper
        modules={[EffectCards, Keyboard, A11y]}
        effect="cards"
        grabCursor
        loop={items.length > 2}
        keyboard={{ enabled: true, onlyInViewport: true }}
        cardsEffect={{ slideShadows: false, perSlideOffset: 9, perSlideRotate: 2, rotate: true }}
        a11y={{ containerMessage: "Destaques do dia", containerRoleDescriptionMessage: "carrossel", itemRoleDescriptionMessage: "item", slideLabelMessage: "{{index}} de {{slidesLength}}", prevSlideMessage: "Destaque anterior", nextSlideMessage: "Próximo destaque" }}
        onSwiper={setSwiper}
        onSlideChange={(s) => setActive(s.realIndex)}
        className={cn(deckBox, "overflow-visible! [&_.swiper-slide]:rounded-[20px]")}
      >
        {items.map((item, index) => (
          <SwiperSlide key={item.id}>
            <StatToneProvider tone={toneOf(index, active)}>
              <div className="h-full rounded-[20px]">{item.node}</div>
            </StatToneProvider>
          </SwiperSlide>
        ))}
      </Swiper>
      <Pager count={items.length} active={active} onGo={go} />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * The enabled highlight cards: a row with arrows from 768 px, a stacked deck below. The "DESTAQUES" row (label, arrows,
 * "Personalizar") is part of this section, so the arrows sit on the same line as the label. With zero cards enabled only the
 * button remains, so the way back to "Personalizar" never disappears.
 */
export function HighlightsSection({ items, customize }: { items: HighlightItem[]; customize: React.ReactNode }) {
  const [api, setApi] = useState<CarouselApi>()
  return (
    <section aria-label="Destaques" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-11 items-center justify-between gap-3">
        {items.length > 0 ? <h2 className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Destaques</h2> : <span />}
        <div className="flex items-center gap-2">
          <HighlightArrows api={api} />
          {customize}
        </div>
      </div>
      {items.length > 0 ? (
        <>
          <div className="md:hidden">
            <CardsDeck items={items} />
          </div>
          <div className="hidden md:block">
            <DesktopRow items={items} onApi={setApi} />
          </div>
        </>
      ) : null}
    </section>
  )
}
