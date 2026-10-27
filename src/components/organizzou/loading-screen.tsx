import { AnimatedLogo } from "@/components/organizzou/animated-logo"
import { cn } from "@/lib/utils"

/**
 * Full-viewport blocking loading state on the theme background token (same color as the PWA splash, so there is no jump).
 * `delayed` fades it in only after ~300 ms with a pure CSS animation delay, so fast navigations never flash it.
 * `icon` uses the icon-only logo (first session load, session refresh, the hand-off after login).
 */
export function LoadingScreen({ icon = false, delayed = false, className }: { icon?: boolean; delayed?: boolean; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={cn("fixed inset-0 z-[100] flex items-center justify-center bg-background", delayed && "loading-delayed", className)}
    >
      {icon ? <AnimatedLogo variant="loading" size="icon" /> : <AnimatedLogo variant="loading" size="lg" iconOnMobile />}
    </div>
  )
}
