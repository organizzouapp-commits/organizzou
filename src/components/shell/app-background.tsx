/**
 * Layer 0 of the app shell: the auth photo, pre-blurred at build time (`npm run glass-bg`), scaled up a little so the soft
 * edges never show, with a theme tint on top (--app-bg-tint). Art direction: the phone only downloads the mobile image.
 * It is `position: fixed` (not background-attachment: fixed) on its own GPU layer with paint containment, so scrolling the
 * content never repaints it.
 */
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 transform-gpu overflow-hidden [contain:paint]">
      <picture>
        <source media="(max-width: 767px)" srcSet="/images/app-bg-blur-mobile.webp" />
        <img src="/images/app-bg-blur.webp" alt="" className="size-full scale-110 object-cover" />
      </picture>
      <div className="absolute inset-0 bg-(--app-bg-tint)" />
    </div>
  )
}
