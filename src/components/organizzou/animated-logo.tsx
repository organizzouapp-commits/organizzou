/* eslint-disable @next/next/no-img-element -- plain <img> on purpose: next/image would not run the SVGs' internal animations */
import { cn } from "@/lib/utils"

const DIR = "/brand/animada"

type Variant = "loading" | "entrance"
type Size = "fluid" | "lg" | "md" | "icon"

type AnimatedLogoProps = {
  /** "entrance" plays the ~2.6 s intro once; "loading" plays it and then loops a calm wave on the bars. */
  variant: Variant
  /** fluid: full-screen loading, min(420px, 80vw) wide. lg: hero (72 px, up to 120 px tall). md: 40 px. icon: the square app icon, only for tiny inline spots (never for loading screens). */
  size?: Size
  /**
   * Use the opposite tone of the theme: for logos over the background photo, where the dark theme gets dark text (like the
   * static logos did). Default follows the theme: light text in dark mode, dark text in light mode.
   */
  inverse?: boolean
  /** Emit <link rel="preload"> for the file(s). Default: only for the entrance logo (above the fold); loading screens are mostly never shown. */
  preload?: boolean
  className?: string
}

const WORDMARK_RATIO = { width: 597, height: 136 }
const SIZE_CLASS: Record<Size, string> = {
  fluid: "w-[min(420px,80vw)]",
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
export function AnimatedLogo({ variant, size = "md", inverse = false, preload = variant === "entrance", className }: AnimatedLogoProps) {
  const src = animatedLogoSources(variant)
  const wrapper = cn("inline-flex shrink-0 items-center justify-center", SIZE_CLASS[size], className)

  if (size === "icon") {
    return (
      <span className={wrapper}>
        {preload ? <link rel="preload" as="image" href={src.icone} /> : null}
        <img src={src.icone} alt="Organizzou" width={120} height={120} decoding="async" className="size-full" />
      </span>
    )
  }

  // Dark theme shows the file for dark backgrounds ("escuro", light text); `inverse` flips that.
  const forDark = inverse ? src.claro : src.escuro
  const forLight = inverse ? src.escuro : src.claro
  // fluid: the box is as wide as the viewport allows and the height follows the intrinsic ratio; otherwise the height is fixed.
  const fit = size === "fluid" ? "h-auto w-full" : "h-full w-auto"
  const img = { ...WORDMARK_RATIO, decoding: "async" as const }

  return (
    <span className={wrapper}>
      {preload ? <link rel="preload" as="image" href={forDark} /> : null}
      <img src={forDark} alt="Organizzou" {...img} className={cn(fit, "hidden dark:block")} />
      <img src={forLight} alt="Organizzou" {...img} className={cn(fit, "block dark:hidden")} />
    </span>
  )
}
