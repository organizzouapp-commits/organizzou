/**
 * Layer 0 of the app shell, rendered once by the (app) layout (a server component: navigation and the shell's state never
 * re-render it): the auth photo LIGHTLY pre-blurred (`npm run glass-bg`, strengths at the top of that script), with art
 * direction (the phone only downloads the mobile image). The files are already optimized WebP, so they are served as-is.
 * The theme tint (--app-bg-tint) is a separate overlay that uses a token.
 * Fixed, strict containment and its own GPU layer: scrolling the content never repaints it. No runtime blur or filter: the
 * soft look is baked into the image, and the heavier frosted look lives inside the frame (see FrameGlass).
 */
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 transform-gpu [contain:strict]">
      <picture>
        <source media="(max-width: 767px)" srcSet="/images/app-bg-mobile.webp" />
        <img
          src="/images/app-bg.webp"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 size-full object-cover object-center"
        />
      </picture>
      <div className="absolute inset-0 bg-(--app-bg-tint)" />
    </div>
  )
}
