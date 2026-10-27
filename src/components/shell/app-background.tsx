/**
 * Layer 0 of the app shell, rendered once by the (app) layout (a server component: navigation and the shell's state never
 * re-render it). The photo is a TINY pre-blurred WebP (64 px wide desktop / 36 px mobile, ~1 KB, `npm run glass-bg`) that the
 * browser upscales with `object-fit: cover`: the upscaling is the blur, so there is no CSS filter and no backdrop-filter.
 * The theme tint is a separate overlay that uses a token. Fixed, strict containment and its own GPU layer: scrolling the
 * content never repaints it. The phone only downloads the mobile image.
 */
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 transform-gpu [contain:strict]">
      <picture>
        <source media="(max-width: 767px)" srcSet="/images/app-bg-tiny-mobile.webp" />
        <img src="/images/app-bg-tiny.webp" alt="" decoding="async" fetchPriority="high" className="size-full object-cover" />
      </picture>
      <div className="absolute inset-0 bg-(--app-bg-tint)" />
    </div>
  )
}
