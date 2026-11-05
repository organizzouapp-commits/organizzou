import { SPLASH_BOOT } from "./splash-boot"
import { SplashLogo } from "./splash-logo"

/**
 * The splash that lives in the server HTML of EVERY page (root layout). It is hidden by CSS unless the boot script sets <html data-splash>,
 * which it does before the first paint of a document that starts within the hand-off window (see splash-resume.ts). Opaque, above the wallpaper
 * and everything else, and independent of hydration; SplashController removes it when the dashboard has real content on screen.
 */
export function SplashShell() {
  return (
    <>
      {/* A real inline script (next/script beforeInteractive would queue it for the bootstrap, after the first paint): parser-blocking, so it runs
          before anything after it is painted. */}
      <script id="splash-boot" dangerouslySetInnerHTML={{ __html: SPLASH_BOOT }} />
      <div id="org-splash" role="status" aria-label="Carregando">
        <SplashLogo />
      </div>
    </>
  )
}
