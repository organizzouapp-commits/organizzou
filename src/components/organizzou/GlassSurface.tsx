import type { ComponentPropsWithRef, ElementType } from "react"

import { cn } from "@/lib/utils"

type GlassSurfaceProps<T extends ElementType> = { as?: T } & Omit<ComponentPropsWithRef<T>, "as">

/**
 * Frosted glass for phones, FAKED (no backdrop-filter, no CSS filter, nothing computed at runtime): the heavily pre-blurred
 * copy of the phone photo (`npm run glass-bg`) painted inside the surface, plus a token tint and a 1 px border. The surface is
 * opaque to the page content that scrolls under it.
 *
 * Alignment: the base layer (AppBackground) is `fixed inset-0` with the photo at `object-fit: cover`, centered. The frost copy
 * is the same box (`fixed inset-0`, `bg-cover bg-center`), so every pixel lands on the same pixel of the base photo wherever
 * the surface is, and it stays aligned while the surface moves or scrolls. A fixed child is NOT clipped by `overflow: hidden`,
 * so the surface is clipped with `clip-path` instead (rounded to a pill). Consequence: no ancestor of a GlassSurface may have a
 * transform / contain / filter (it would become the containing block of the fixed layer), so animate such a surface with
 * `top` / `opacity`, never with transform.
 *
 * Phones only (below md): the frost image is a CSS background, so it is never downloaded when the surface is hidden.
 * Render any element with `as` (default div); children paint above the glass.
 */
export function GlassSurface<T extends ElementType = "div">({ as, className, children, ...props }: GlassSurfaceProps<T>) {
  const Component: ElementType = as ?? "div"
  return (
    <Component
      className={cn("relative isolate border border-border [clip-path:inset(0_round_9999px)]", className)}
      {...props}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span className="fixed inset-0 bg-[url('/images/app-bg-mobile-frost.webp')] bg-cover bg-center" />
        <span className="absolute inset-0 bg-background/60" />
      </span>
      {children}
    </Component>
  )
}
