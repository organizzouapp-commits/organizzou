"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { SectionHeader } from "@/components/organizzou/SectionHeader"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { HighlightDeck } from "@/components/organizzou/highlight-deck"

import { Button } from "@/components/ui/button"
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel"

import { StatToneProvider } from "./stat-card"

export type HighlightItem = { id: string; node: React.ReactNode }

/** Exactly one card is Lima: the one in front. Everything else is the normal card surface. */
const toneOf = (index: number, front: number) => (index === front ? ("highlight" as const) : ("default" as const))

const GAP = 16
const MIN_CARD = 240
const MAX_CARD = 320

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
      <Button type="button" size="icon" className="size-9 rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/85 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50" aria-label="Destaques anteriores" disabled={!state.prev} onClick={() => api.scrollPrev()}>
        <ChevronLeftIcon strokeWidth={1.75} />
      </Button>
      <Button type="button" size="icon" className="size-9 rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/85 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50" aria-label="Próximos destaques" disabled={!state.next} onClick={() => api.scrollNext()}>
        <ChevronRightIcon strokeWidth={1.75} />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
// < 768 px: the shared card deck (HighlightDeck). The card in front is Lima with the normal card surface, the others fan out behind it.

/** The deck is a fixed 172 px high, so server HTML and client render have the same size: no layout jump. */
function CardsDeck({ items }: { items: HighlightItem[] }) {
  const slides = items.map((item) => ({
    id: item.id,
    render: (front: boolean) => (
      <StatToneProvider tone={front ? "highlight" : "default"}>
        <div className="h-full rounded-[20px]">{item.node}</div>
      </StatToneProvider>
    ),
  }))
  return <HighlightDeck slides={slides} label="Destaques do dia" stripLabel="Destaques" noun="destaque" height={172} />
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
      <SectionHeader
        title={items.length > 0 ? "Destaques" : ""}
        actions={
          <>
            <HighlightArrows api={api} />
            {customize}
          </>
        }
      />
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
