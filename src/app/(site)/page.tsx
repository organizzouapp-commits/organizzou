import { ChevronRightIcon } from "lucide-react"
import { getImageProps } from "next/image"
import Link from "next/link"

import { CursorGlow } from "@/components/site/cursor-glow"
import { ON_PHOTO, reveal, SiteLogo } from "@/components/site/site-parts"
import { ThemeToggle } from "@/components/organizzou/ThemeToggle"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const glass = "border-2 backdrop-blur-[16px]"
// Light theme: Papel text on a dark glass. Dark theme: Tinta text on a light glass (same logic as the auth panel).
const pillGlass = "border-palette-papel/15 bg-palette-papel/8 dark:border-palette-tinta/15 dark:bg-palette-tinta/8"
const capsuleGlass = "border-palette-papel/15 bg-palette-grafite/35 dark:border-palette-tinta/15 dark:bg-palette-papel/30"

// Footer links: the underline fades and grows in 0.4 s (text-decoration-line itself can't animate, its color can).
const link =
  "rounded-sm underline decoration-transparent underline-offset-4 outline-none transition-[text-decoration-color,text-underline-offset] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:decoration-current hover:underline-offset-[6px] focus-visible:decoration-current focus-visible:underline-offset-[6px] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"

export default function ComingSoonPage() {
  // Same photo as the auth screen, art-directed: phones only download the mobile image.
  const base = { alt: "", fill: true, priority: true, sizes: "100vw" } as const
  const {
    props: { srcSet: desktopSrcSet, ...desktopRest },
  } = getImageProps({ ...base, src: "/images/auth-background.png" })
  const {
    props: { srcSet: mobileSrcSet },
  } = getImageProps({ ...base, src: "/images/auth-background-mobile.png" })
  // The Next.js dev indicator sits bottom-left in development only: keep the footer links clear of it.
  const dev = process.env.NODE_ENV === "development"

  return (
    <div className="relative flex min-h-dvh flex-col">
      <picture>
        <source media="(max-width: 767px)" srcSet={mobileSrcSet} />
        <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
        <img {...desktopRest} alt="" className="-z-10 object-cover object-center" />
      </picture>

      <ThemeToggle
        round
        tooltip
        className={cn(
          "fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-40 size-12 lg:top-6 lg:right-6",
          "border-palette-papel/12 bg-palette-tinta text-highlight hover:scale-105 hover:border-transparent hover:bg-highlight hover:text-palette-tinta dark:border-palette-papel/12 dark:bg-palette-tinta dark:hover:bg-highlight",
          "shadow-[0_8px_24px_color-mix(in_oklab,var(--palette-tinta)_35%,transparent)] focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-5 [&_svg]:stroke-2",
          "transition-[color,background-color,border-color,scale] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        )}
      />
      <CursorGlow />

      <main className={cn("flex flex-1 flex-col items-center justify-center gap-[clamp(20px,4.5dvh,45px)] px-5 pt-16 text-center lg:px-8", ON_PHOTO)}>
        <div className="flex flex-col items-center gap-[clamp(16px,3dvh,30px)]">
          <div className="site-zoom" style={reveal(0)}>
            <SiteLogo className="h-[72px] md:h-[clamp(72px,15dvh,120px)]" />
          </div>
          <div
            className={cn("site-zoom inline-flex items-center gap-3.5 rounded-full px-6 py-3 text-base md:text-lg", glass, pillGlass)}
            style={reveal(1)}
          >
            <span aria-hidden className="size-[23px] shrink-0 animate-[spin_2s_linear_infinite] rounded-full border-2 border-current/25 border-t-current" />
            <span>App em construção</span>
          </div>
        </div>

        <div
          className={cn(
            "flex w-full max-w-[960px] flex-col items-center gap-5 rounded-[28px] px-6 py-7 text-center lg:flex-row lg:justify-between lg:gap-10 lg:rounded-full lg:px-[clamp(40px,6vw,80px)] lg:py-[clamp(24px,5dvh,45px)] lg:text-left",
            "max-lg:max-w-[440px]",
            glass,
            capsuleGlass,
            ON_PHOTO
          )}
        >
          <p className="site-left max-w-[460px] text-base leading-[1.35] text-balance opacity-90 md:text-lg" style={reveal(2)}>
            O app que <strong className="font-semibold opacity-100">organiza sua vida inteira</strong> está chegando. Tarefas, finanças, treinos, estudos e um assistente no WhatsApp, num só lugar. Já tem acesso?
          </p>
          {/* The entrance animation lives on this wrapper; the hover/active scale lives on the button itself (.site-cta). */}
          <div className="site-right w-full lg:w-auto" style={reveal(3)}>
            <Button
              asChild
              size="xl"
              className="site-cta h-[52px] w-full shrink-0 rounded-full bg-highlight px-7 text-[17px] font-medium text-highlight-foreground hover:bg-highlight lg:w-auto"
            >
              <Link href="/login" prefetch>
                <ChevronRightIcon strokeWidth={2} className="size-5" /> Entrar no Organizzou
              </Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Always Papel text: the bottom of the photo is dark in both themes. A Tinta scrim (0 -> 55%) sits behind the footer only. */}
      <footer
        className={cn(
          "site-up relative isolate flex flex-col items-center gap-4 px-5 pt-10 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] text-center text-palette-papel",
          dev && "max-md:pb-20"
        )}
        style={reveal(4)}
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-0 -z-10 bg-gradient-to-t from-palette-tinta/55 to-palette-tinta/0" />
        <span aria-hidden className="block h-[3px] w-[88vw] max-w-[1280px] rounded-full bg-palette-papel/20 md:w-[70vw]" />
        <p className="text-sm leading-[1.4] text-palette-papel/70 md:text-base">
          Copyright © 2026 Organizzou. <br className="md:hidden" />
          <strong className="font-semibold text-palette-papel">Todos os direitos reservados.</strong>
        </p>
        <nav aria-label="Informações legais" className="flex gap-4 text-[13px] leading-5 text-palette-papel">
          <Link href="/politicas#termos" className={link}>
            Termos de uso
          </Link>
          <span aria-hidden>·</span>
          <Link href="/politicas#privacidade" className={link}>
            Política de privacidade
          </Link>
        </nav>
      </footer>
    </div>
  )
}
