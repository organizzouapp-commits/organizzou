"use client"

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Peek of the neighbours (12% of the screen each) comes from the 68% slide basis; the tween only moves, scales and fades. */
const MAX_ROTATE = 18
const MIN_SCALE = 0.86
const MIN_OPACITY = 0.6

/**
 * Phones: a 3D coverflow. The active slide is flat and full size; the neighbours turn ±18°, shrink to 86% and fade to 60%.
 * Everything is driven by Embla's scroll progress and written straight to `transform`/`opacity` of an inner wrapper (no React
 * re-render per frame, no blur, no shadows), so it stays on the compositor. With `prefers-reduced-motion` the same carousel
 * is a plain snapping strip: no loop, no tween, no 3D.
 */
export function StatsCarousel({ items, label = "Destaques" }: { items: React.ReactNode[]; label?: string }) {
  const reduced = useSyncExternalStore(subscribeReduced, reducedNow, () => false)
  const [api, setApi] = useState<CarouselApi>()
  const [selected, setSelected] = useState(0)
  const opts = useMemo(() => ({ align: "center" as const, loop: !reduced, skipSnaps: false, containScroll: false as const }), [reduced])

  const tween = useCallback(
    (embla: NonNullable<CarouselApi>) => {
      const slides = embla.slideNodes()
      const inner = (i: number) => slides[i]?.firstElementChild as HTMLElement | null
      if (reduced) {
        slides.forEach((_, i) => {
          const el = inner(i)
          if (el) {
            el.style.transform = ""
            el.style.opacity = ""
          }
        })
        return
      }
      const engine = embla.internalEngine()
      const progress = embla.scrollProgress()
      const snaps = embla.scrollSnapList()
      snaps.forEach((snap, i) => {
        let diff = snap - progress
        // With loop, a slide that wrapped around is measured from the other side.
        if (engine.options.loop) {
          engine.slideLooper.loopPoints.forEach((point) => {
            const target = point.target()
            if (i === point.index && target !== 0) {
              const sign = Math.sign(target)
              if (sign === -1) diff = snap - (1 + progress)
              if (sign === 1) diff = snap + (1 - progress)
            }
          })
        }
        // `d` is the distance to the centre in slides: 0 = active, ±1 = the next one.
        const d = Math.max(-1, Math.min(1, diff * snaps.length))
        const a = Math.abs(d)
        const el = inner(i)
        if (!el) return
        el.style.transform = `perspective(900px) rotateY(${(-d * MAX_ROTATE).toFixed(2)}deg) scale(${(1 - (1 - MIN_SCALE) * a).toFixed(3)})`
        el.style.opacity = String(1 - (1 - MIN_OPACITY) * a)
      })
    },
    [reduced]
  )

  useEffect(() => {
    if (!api) return
    const onSelect = () => setSelected(api.selectedScrollSnap())
    const onTween = () => tween(api)
    onSelect()
    onTween()
    api.on("select", onSelect).on("reInit", onSelect).on("reInit", onTween).on("scroll", onTween).on("slideFocus", onTween)
    return () => {
      api.off("select", onSelect).off("reInit", onSelect).off("reInit", onTween).off("scroll", onTween).off("slideFocus", onTween)
    }
  }, [api, tween])

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Bleeds to the screen edges so the neighbours peek in. Hidden until Embla has centred the slides: no jump on load. */}
      <Carousel
        opts={opts}
        setApi={setApi}
        aria-label={label}
        tabIndex={0}
        className={cn("-mx-4 w-[calc(100%+2rem)] self-stretch rounded-3xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50", !api && "invisible")}
      >
        <CarouselContent className="ml-0 touch-pan-y touch-pinch-zoom">
          {items.map((item, index) => (
            <CarouselItem
              key={index}
              aria-label={`${index + 1} de ${items.length}`}
              className="basis-[68%] py-2 pl-0 pr-3 first:ml-0 [&>*]:will-change-transform"
            >
              <div className="h-full origin-center [backface-visibility:hidden]">{item}</div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div role="tablist" aria-label="Escolher destaque" className="flex items-center">
        {items.map((_, index) => {
          const active = index === selected
          return (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`Destaque ${index + 1} de ${items.length}`}
              onClick={() => api?.scrollTo(index)}
              className="group flex h-11 min-w-8 items-center justify-center outline-none"
            >
              <span
                className={cn(
                  "h-2 rounded-full border border-border transition-[width,background-color] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] group-focus-visible:ring-3 group-focus-visible:ring-ring/50 motion-reduce:transition-none",
                  active ? "w-6 border-transparent bg-highlight" : "w-2 bg-muted"
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
