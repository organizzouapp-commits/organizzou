import { getImageProps } from "next/image"

/**
 * Layer 0 of the app shell, rendered once by the (app) layout (a server component: navigation and the shell's state never
 * re-render it): the ORIGINAL auth photo, sharp, with art direction (the phone only downloads the mobile image) and
 * optimized AVIF/WebP through next/image. The theme tint (--app-bg-tint) is a separate overlay that uses a token.
 * Fixed, strict containment and its own GPU layer: scrolling the content never repaints it. No blur here: the frosted
 * look lives inside the frame (see FrameGlass).
 */
export function AppBackground() {
  const common = { alt: "", fill: true, priority: true, sizes: "100vw" } as const
  const {
    props: { srcSet: desktopSrcSet, ...desktopRest },
  } = getImageProps({ ...common, src: "/images/auth-background.png" })
  const {
    props: { srcSet: mobileSrcSet },
  } = getImageProps({ ...common, src: "/images/auth-background-mobile.png" })

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 transform-gpu [contain:strict]">
      <picture>
        <source media="(max-width: 767px)" srcSet={mobileSrcSet} />
        <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
        <img {...desktopRest} alt="" className="object-cover object-center" />
      </picture>
      <div className="absolute inset-0 bg-(--app-bg-tint)" />
    </div>
  )
}
