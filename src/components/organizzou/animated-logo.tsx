/* eslint-disable @next/next/no-img-element -- plain <img> on purpose: next/image would not run the SVGs' internal animations */
import { cn } from "@/lib/utils"

const DIR = "/brand/animada"

type Variant = "loading" | "entrance"
type Size = "lg" | "md" | "icon"

type AnimatedLogoProps = {
  /** "entrance" plays the ~2.6 s intro once; "loading" plays it and then loops a calm wave on the bars. */
  variant: Variant
  /** lg: hero (72 px, up to 120 px on tall screens). md: 40 px. icon: the square app icon. */
  size?: Size
  /**
   * Use the opposite tone of the theme: for logos over the background photo, where the dark theme gets dark text (like the
   * static logos did). Default follows the theme: light text in dark mode, dark text in light mode.
   */
  inverse?: boolean
  /** Swap the wordmark for the icon below 768 px, where the wide logo would not fit. */
  iconOnMobile?: boolean
  className?: string
}

const WORDMARK_RATIO = { width: 597, height: 136 }
const SIZE_CLASS: Record<Size, string> = {
  lg: "h-[72px] md:h-[clamp(72px,15dvh,120px)]",
  md: "h-10",
  icon: "size-16",
}

/** Files that start with the logo's own artwork, one per theme. Plain <img>: SVG animations only run outside next/image. */
export function animatedLogoSources(variant: Variant) {
  return {
    escuro: `${DIR}/organizzou-logo-${variant === "loading" ? "carregamento" : "entrada"}-escuro.svg`,
    claro: `${DIR}/organizzou-logo-${variant === "loading" ? "carregamento" : "entrada"}-claro.svg`,
    icone: `${DIR}/organizzou-icone-${variant === "loading" ? "carregamento" : "entrada"}.svg`,
  }
}

/**
 * The animated Organizzou logo. Both theme files are rendered and toggled with `dark:` classes, so there is no hydration
 * mismatch and no flash. The wrapper has a fixed height and the images carry their intrinsic size, so nothing shifts.
 * Rendered without hooks: usable from server and client components. Preloads the files for the route (React hoists <link>).
 */
export function AnimatedLogo({ variant, size = "md", inverse = false, iconOnMobile = false, className }: AnimatedLogoProps) {
  const src = animatedLogoSources(variant)
  const wrapper = cn("inline-flex shrink-0 items-center justify-center", SIZE_CLASS[size], className)

  if (size === "icon") {
    return (
      <span className={wrapper}>
        <link rel="preload" as="image" href={src.icone} />
        <img src={src.icone} alt="Organizzou" width={120} height={120} decoding="async" className="size-full" />
      </span>
    )
  }

  // Dark theme shows the file for dark backgrounds ("escuro", light text); `inverse` flips that.
  const forDark = inverse ? src.claro : src.escuro
  const forLight = inverse ? src.escuro : src.claro
  const img = { ...WORDMARK_RATIO, decoding: "async" as const }

  return (
    <span className={wrapper}>
      <link rel="preload" as="image" href={forDark} media={iconOnMobile ? "(min-width: 768px)" : undefined} />
      {iconOnMobile ? <link rel="preload" as="image" href={src.icone} media="(max-width: 767px)" /> : null}
      {iconOnMobile ? <img src={src.icone} alt="Organizzou" width={120} height={120} decoding="async" className="h-full w-auto md:hidden" /> : null}
      <img src={forDark} alt="Organizzou" {...img} className={cn("h-full w-auto", iconOnMobile ? "hidden dark:md:block" : "hidden dark:block")} />
      <img src={forLight} alt="Organizzou" {...img} className={cn("h-full w-auto", iconOnMobile ? "hidden md:block dark:md:hidden" : "block dark:hidden")} />
    </span>
  )
}
