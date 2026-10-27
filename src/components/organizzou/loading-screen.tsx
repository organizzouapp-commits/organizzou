import { AnimatedLogo } from "@/components/organizzou/animated-logo"
import { cn } from "@/lib/utils"

/**
 * Full-viewport blocking loading state on the theme background token (same color as the PWA splash, so there is no jump).
 * `delayed` fades it in only after ~300 ms with a pure CSS animation delay, so fast navigations never flash it.
 */
export function LoadingScreen({ delayed = false, className }: { delayed?: boolean; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={cn("fixed inset-0 z-[100] flex items-center justify-center bg-background", delayed && "loading-delayed", className)}
    >
      <AnimatedLogo variant="loading" size="fluid" />
    </div>
  )
}
