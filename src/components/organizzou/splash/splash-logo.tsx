import { SPLASH_SVG_DARK, SPLASH_SVG_LIGHT } from "./splash-svg"

/**
 * THE animated logotype of every loading state (the post-login splash, the route loading states, the hand-off overlay): the artwork of
 * public/brand/animada inlined, so CSS can resume its intro (--splash-elapsed on <html>) and show its final frame (<html data-splash-final>).
 * Both theme files are in the markup and toggled with `dark:`, so there is no hydration mismatch and no flash.
 */
export function SplashLogo({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Organizzou" className={`org-splash-logo inline-flex w-[min(420px,80vw)] shrink-0 items-center justify-center ${className ?? ""}`}>
      <span className="hidden w-full dark:block" dangerouslySetInnerHTML={{ __html: SPLASH_SVG_DARK }} />
      <span className="block w-full dark:hidden" dangerouslySetInnerHTML={{ __html: SPLASH_SVG_LIGHT }} />
    </span>
  )
}
