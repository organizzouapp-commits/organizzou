import { cn } from "@/lib/utils"

import { SplashGate } from "./splash-gate"
import { SplashLogo } from "./splash/splash-logo"

type Props = { delayed?: boolean; preload?: boolean; className?: string }

/** The still logotype (the animation's resting frame), one file per theme, same box as the animated one. */
function StillLogo() {
  const img = { width: 597, height: 136, decoding: "async" as const }
  return (
    <span className="inline-flex w-[min(420px,80vw)] shrink-0 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, same as the animated ones */}
      <img src="/brand/organizzou-logotipo-modo-escuro.svg" alt="Organizzou" {...img} className="hidden h-auto w-full dark:block" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, same as the animated ones */}
      <img src="/brand/organizzou-logotipo-modo-claro.svg" alt="Organizzou" {...img} className="block h-auto w-full dark:hidden" />
    </span>
  )
}

/** The screen itself, with no gate: the hand-off overlay draws this one. */
export function LoadingScreenView({ delayed = false, className, still = false, fallback = true }: Props & { still?: boolean; /** A route loading state (hidden while the post-login splash is on); false for the hand-off overlay itself. */ fallback?: boolean }) {
  return (
    <div role="status" aria-label="Carregando" data-fallback-splash={fallback ? "" : undefined} className={cn("fixed inset-0 z-[100] flex items-center justify-center bg-background", delayed && "loading-delayed", className)}>
      {still ? <StillLogo /> : <SplashLogo />}
    </div>
  )
}

/**
 * Full-viewport blocking loading state on the theme background token (same color as the PWA splash, so there is no jump).
 * `delayed` fades it in only after ~300 ms with a pure CSS animation delay, so fast navigations never flash it. Gated: see SplashGate.
 */
export function LoadingScreen(props: Props) {
  return <SplashGate animated={<LoadingScreenView {...props} />} still={<LoadingScreenView {...props} still />} />
}
