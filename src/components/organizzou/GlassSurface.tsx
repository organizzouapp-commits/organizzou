import type { ComponentPropsWithRef, ElementType } from "react"

import { cn } from "@/lib/utils"

type GlassSurfaceProps<T extends ElementType> = {
  as?: T
  /** Tint and border only, no photo layer: a subtle dark (or light) pill, for small surfaces like the menu chips. */
  flat?: boolean
} & Omit<ComponentPropsWithRef<T>, "as">

/**
 * Frosted glass for phones, FAKED (no backdrop-filter, no CSS filter, nothing computed at runtime). Layers, bottom to top:
 * a pre-blurred, desaturated copy of the phone photo (`npm run glass-bg`: dark variant, light variant), a token tint
 * (bg-card in dark, bg-background in light), the content, and a 1 px border drawn as a `::after` overlay on top, so it follows
 * the radius exactly and the photo can never bleed over it. The surface is opaque to the page content scrolling under it.
 *
 * Alignment: the base layer (AppBackground) is `fixed inset-0` with the photo at `object-fit: cover`, centered. The photo
 * layer is the same box (`fixed inset-0`, `bg-cover bg-center`), so every pixel lands on the same pixel of the base photo
 * wherever the surface is, and it stays aligned while the surface moves or scrolls. A fixed child is NOT clipped by
 * `overflow: hidden`, so the surface is clipped with `clip-path` (rounded to a pill) instead. Consequence: no ancestor of a
 * GlassSurface may have a transform / contain / filter (it would become the containing block of the fixed layer), and the
 * surface itself cannot use `translateZ(0)`; animate such a surface with `top` / `opacity`, never with transform.
 *
 * Phones only (below md): the photo is a CSS background, so it is never downloaded when the surface is hidden.
 * Render any element with `as` (default div); it is always fully rounded.
 */
export function GlassSurface<T extends ElementType = "div">({ as, flat = false, className, children, ...props }: GlassSurfaceProps<T>) {
  const Component: ElementType = as ?? "div"
  return (
    <Component
      className={cn(
        "relative isolate rounded-full [clip-path:inset(0_round_9999px)]",
        "after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:border after:border-border after:content-['']",
        className
      )}
      {...props}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {flat ? null : (
          <span className="fixed inset-0 bg-[url('/images/app-bg-mobile-glass-light.webp')] bg-cover bg-center dark:bg-[url('/images/app-bg-mobile-glass-dark.webp')]" />
        )}
        <span className="absolute inset-0 bg-background/65 dark:bg-card/60" />
      </span>
      {children}
    </Component>
  )
}
