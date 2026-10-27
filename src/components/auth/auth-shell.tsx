"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { getImageProps } from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { AnimatedLogo } from "@/components/organizzou/animated-logo"
import { ThemeToggle } from "@/components/organizzou/ThemeToggle"
import { safeNextPath } from "@/lib/safe-next"
import { cn } from "@/lib/utils"

import { authLinkClass, authMotion, R, rs, SlideSwap } from "./auth-parts"
import { ForgotPasswordForm } from "./forgot-password-form"
import { ResetPasswordForm } from "./reset-password-form"
import { SignInForm } from "./sign-in-form"
import { SignUpForm } from "./sign-up-form"

type Mode = "login" | "signup" | "forgot" | "reset"
type Target = "login" | "signup"

function modeFor(pathname: string): Mode {
  if (pathname.startsWith("/cadastro")) return "signup"
  if (pathname.startsWith("/recuperar-senha/nova-senha")) return "reset"
  if (pathname.startsWith("/recuperar-senha")) return "forgot"
  return "login"
}

const COPY = {
  login: {
    badge: "Bom te ver de novo",
    headline: "Sua vida, organizada.",
    subtitle: "Entre para ver o seu dia.",
    steps: ["Veja seu dia organizado", "Fale com o assistente", "Receba lembretes diariamente"],
  },
  signup: {
    badge: "Comece agora",
    headline: "Comece a se organizar",
    subtitle: "Três passos e pronto.",
    steps: ["Crie sua conta agora", "Conecte seu WhatsApp", "Organize seu dia a dia"],
  },
} as const

type CopyKey = keyof typeof COPY

// One easing for every movement in the shell (DESIGN-SYSTEM §6).
const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]"

/** Text on the photo follows the theme, matching the logo: dark theme -> Tinta (logo-preta), light theme -> Papel (logo-branca). */
const ON_PHOTO = "text-palette-papel dark:text-palette-tinta"

/** Scrim of the opposite tone, only as strong as needed: Tinta behind Papel text (light), Papel behind Tinta text (dark). */
const SCRIM = "bg-gradient-to-b from-palette-tinta/10 via-palette-tinta/20 to-palette-tinta/35 dark:from-palette-papel/0 dark:via-palette-papel/10 dark:to-palette-papel/25"

const glass =
  "border-2 border-palette-papel/20 bg-palette-papel/10 backdrop-blur-[16px] dark:border-palette-tinta/20 dark:bg-palette-tinta/10"

const BELOW_LG = "(max-width: 1023px)"

/** True below the desktop breakpoint (phones and tablets get the welcome screen + bottom sheet). */
function useBelowLg() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(BELOW_LG)
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => window.matchMedia(BELOW_LG).matches,
    () => false
  )
}

/** The animated entrance logo over the photo: dark theme gets dark text, light theme light text (inverse of the theme). */
function ThemedLogo({ className }: { className: string }) {
  return <AnimatedLogo variant="entrance" inverse className={className} />
}

function HighlightCopy({
  copyKey,
  active,
  activeStep,
  onStep,
}: {
  copyKey: CopyKey
  active: boolean
  activeStep: number
  onStep: (index: number) => void
}) {
  const copy = COPY[copyKey]
  const enter = cn("duration-300", authMotion, active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")
  // The entrance reveal only runs on the visible copy.
  const reveal = active ? R : ""
  return (
    <div aria-hidden={!active} inert={!active} className={cn("col-start-1 row-start-1 flex flex-col gap-(--auth-gap)", !active && "pointer-events-none")}>
      <span
        className={cn("auth-hide-short inline-flex w-fit items-center rounded-full px-3 py-1 text-[13px] leading-5", ON_PHOTO, glass, enter, reveal)}
        style={{ transitionDelay: "0ms", ...rs(1) }}
      >
        {copy.badge}
      </span>
      <h2
        className={cn("text-(length:--auth-hl) leading-[1.12] font-semibold tracking-[-0.02em]", ON_PHOTO, enter, reveal)}
        style={{ transitionDelay: active ? "60ms" : "0ms", ...rs(2) }}
      >
        {copy.headline}
      </h2>
      <p className={cn("auth-hide-tiny text-(length:--auth-sub) leading-snug opacity-80", ON_PHOTO, enter, reveal)} style={{ transitionDelay: active ? "120ms" : "0ms", ...rs(3) }}>
        {copy.subtitle}
      </p>
      <ol className="mt-1 grid grid-cols-3 gap-[clamp(8px,1.5dvh,12px)]">
        {copy.steps.map((label, index) => {
          const isActive = index === activeStep
          return (
            // Swap: fade + 8 px slide, staggered 60 ms. The hover lift lives on the inner button.
            <li key={label} className={cn(enter, reveal)} style={{ transitionDelay: active ? `${180 + index * 60}ms` : "0ms", ...rs(4 + index) }}>
              <button
                type="button"
                onClick={() => onStep(index)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "group/step flex min-h-(--auth-step-h) h-full w-full cursor-pointer flex-col justify-between gap-2 rounded-[20px] border-2 p-[clamp(10px,1.8dvh,16px)] text-left outline-none",
                  "hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:ring-3 focus-visible:ring-ring/50",
                  "transition-all duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
                  isActive
                    ? "border-palette-papel/20 bg-highlight text-highlight-foreground dark:border-palette-tinta/20"
                    : cn(
                        "border-palette-papel/20 bg-palette-papel/8 backdrop-blur-[16px]",
                        "dark:border-palette-tinta/20 dark:bg-palette-tinta/8",
                        // Hover/focus: the whole card takes the active (Lima) style.
                        "hover:border-highlight hover:bg-highlight hover:text-highlight-foreground focus-visible:border-highlight focus-visible:bg-highlight focus-visible:text-highlight-foreground",
                        "dark:hover:border-highlight dark:hover:bg-highlight dark:focus-visible:border-highlight dark:focus-visible:bg-highlight",
                        ON_PHOTO
                      )
                )}
              >
                <span
                  className={cn(
                    "tabular flex size-[clamp(26px,4dvh,32px)] items-center justify-center rounded-full border-2 text-[14px] leading-5 font-semibold",
                    "transition-all duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
                    isActive
                      ? "border-highlight-foreground bg-highlight-foreground text-highlight"
                      : "border-palette-papel/50 dark:border-palette-tinta/50 group-hover/step:border-highlight-foreground group-hover/step:bg-highlight-foreground group-hover/step:text-highlight group-focus-visible/step:border-highlight-foreground group-focus-visible/step:bg-highlight-foreground group-focus-visible/step:text-highlight"
                  )}
                >
                  {index + 1}
                </span>
                <span className="text-(length:--auth-text) leading-[1.2]">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function HighlightPanel({ signup, className }: { signup: boolean; className?: string }) {
  // Active step per copy (visual only).
  const [steps, setSteps] = useState<Record<CopyKey, number>>({ login: 0, signup: 0 })
  return (
    <aside aria-label="Organizzou" className={cn("relative flex flex-col justify-between gap-4 overflow-hidden rounded-[20px] p-[clamp(16px,3.2dvh,28px)]", ON_PHOTO, className)}>
      {/* Transparent panel: the photo shows through; only the subtle scrim helps legibility. */}
      <span aria-hidden className={cn("pointer-events-none absolute inset-0", SCRIM)} />
      <div className="relative">
        <ThemedLogo className="h-(--auth-logo)" />
      </div>
      <div className="relative grid">
        <HighlightCopy copyKey="login" active={!signup} activeStep={steps.login} onStep={(i) => setSteps((s) => ({ ...s, login: i }))} />
        <HighlightCopy copyKey="signup" active={signup} activeStep={steps.signup} onStep={(i) => setSteps((s) => ({ ...s, signup: i }))} />
      </div>
    </aside>
  )
}

/** Mobile screen 1: welcome over the photo, with the Entrar / Criar conta bottom bar. */
function MobileWelcome({ hidden, onOpen }: { hidden: boolean; onOpen: (target: Target) => void }) {
  return (
    <div
      inert={hidden}
      aria-hidden={hidden}
      className={cn("fixed inset-0 z-10 flex flex-col transition-opacity duration-500 lg:hidden", ON_PHOTO, hidden && "opacity-0")}
    >
      <span aria-hidden className={cn("pointer-events-none absolute inset-0", SCRIM)} />
      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <div>
          <ThemedLogo className="h-10" />
        </div>
        <h2 className={cn("mt-2 text-[34px] leading-[42px] font-semibold tracking-[-0.02em]", R)} style={rs(1)}>
          Sua vida, organizada.
        </h2>
        <p className={cn("text-base leading-6 opacity-80", R)} style={rs(2)}>
          Tudo do seu dia em um só lugar.
        </p>
      </div>
      <div className={cn("relative grid h-[calc(72px+env(safe-area-inset-bottom))] grid-cols-2", R)} style={rs(3)}>
        <button
          type="button"
          onClick={() => onOpen("login")}
          className={cn(
            "pb-[env(safe-area-inset-bottom)] text-base leading-6 font-semibold outline-none hover:bg-palette-papel/10 focus-visible:bg-palette-papel/10 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-palette-papel/15",
            "dark:hover:bg-palette-tinta/10 dark:focus-visible:bg-palette-tinta/10 dark:active:bg-palette-tinta/15",
            authMotion
          )}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => onOpen("signup")}
          className={cn(
            "rounded-tl-[28px] bg-highlight pb-[env(safe-area-inset-bottom)] text-base leading-6 font-semibold text-highlight-foreground outline-none hover:bg-highlight/90 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] active:bg-highlight/80",
            authMotion
          )}
        >
          Criar conta
        </button>
      </div>
    </div>
  )
}

function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Informações legais" className={cn("flex justify-center gap-4 text-[13px] leading-5 text-muted-foreground", R, className)} style={rs(10)}>
      <Link href="/politicas#termos" className={cn(authLinkClass, "hover:underline")}>
        Termos de uso
      </Link>
      <span aria-hidden>·</span>
      <Link href="/politicas#privacidade" className={cn(authLinkClass, "hover:underline")}>
        Política de privacidade
      </Link>
    </nav>
  )
}

/** One side of the card (and, on phones, the content of the bottom sheet). */
function FormPane({ active, side, children }: { active: boolean; side: "left" | "right"; children: React.ReactNode }) {
  return (
    <section
      data-crossfade
      aria-hidden={!active}
      inert={!active}
      className={cn(
        authMotion,
        // Phones: 24 px sheet padding. Desktop: the panel's 28 px inner padding, none below the legal links.
        "relative flex-col px-6 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))] duration-[550ms] lg:row-start-1 lg:flex lg:min-h-0 lg:px-(--auth-pp) lg:pt-(--auth-pp) lg:pb-0",
        side === "left" ? "lg:col-start-1" : "lg:col-start-2",
        active
          ? "flex opacity-100 lg:translate-x-0 max-lg:animate-in max-lg:duration-300 max-lg:fade-in"
          : cn("hidden lg:pointer-events-none lg:flex lg:opacity-0", side === "left" ? "lg:-translate-x-6" : "lg:translate-x-6")
      )}
    >
      <div className="flex flex-1 items-center justify-center py-2 lg:min-h-0 lg:py-[clamp(4px,1dvh,16px)]">{children}</div>
      <LegalLinks className="mt-3 lg:mt-0 lg:pb-[clamp(8px,1.6dvh,16px)]" />
    </section>
  )
}

export function AuthShell() {
  const pathname = usePathname()
  const params = useSearchParams()
  const mode = modeFor(pathname)
  const signup = mode === "signup"
  const below = useBelowLg()

  const nextParam = params.get("next")
  const next = safeNextPath(nextParam)

  // Phones: a direct visit shows the welcome screen; /cadastro, recovery, ?next= and the redirect after logout open the sheet.
  const [sheetOpen, setSheetOpen] = useState(() => mode !== "login" || params.has("next") || params.has("erro") || params.has("error") || params.has("saiu"))
  const [intro, setIntro] = useState(true)
  const [drag, setDrag] = useState(0)
  const pushed = useRef(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const logoAreaRef = useRef<HTMLDivElement>(null)
  const gesture = useRef({ startY: 0, lastY: 0, lastT: 0, velocity: 0, scrollTop: 0, dragging: false })

  // The entrance reveal runs once per page load; afterwards the attribute goes away so nothing replays.
  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), 2800)
    return () => window.clearTimeout(timer)
  }, [])

  // Browser Back closes the sheet. When the sheet starts open there is no history entry for it yet, so add one.
  useEffect(() => {
    if (sheetOpen && window.matchMedia(BELOW_LG).matches && !pushed.current) {
      window.history.pushState({ authSheet: true }, "")
      pushed.current = true
    }
    // Only the initial state matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onPop() {
      pushed.current = false
      setSheetOpen(false)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  // The cookie bar sits above the welcome bar and stays out of the way while the sheet is open.
  useEffect(() => {
    if (!below) return
    const root = document.documentElement
    if (sheetOpen) root.dataset.cookieBar = "hidden"
    else root.style.setProperty("--cookie-bar-offset", "calc(72px + env(safe-area-inset-bottom))")
    return () => {
      delete root.dataset.cookieBar
      root.style.removeProperty("--cookie-bar-offset")
    }
  }, [below, sheetOpen])

  // The logo sits centered in the photo that stays visible above the sheet, wherever the sheet's top edge is.
  useEffect(() => {
    const sheet = sheetRef.current
    const area = logoAreaRef.current
    if (!below || !sheet || !area) return
    function place() {
      if (!sheet || !area) return
      area.style.height = `${Math.max(72, window.innerHeight - sheet.offsetHeight)}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(sheet)
    window.addEventListener("resize", place)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", place)
    }
  }, [below])

  function openSheet(target: Target) {
    const path = target === "signup" ? "/cadastro" : "/login"
    const query = params.toString()
    window.history.pushState({ authSheet: true }, "", query ? `${path}?${query}` : path)
    pushed.current = true
    setSheetOpen(true)
  }

  function closeSheet() {
    if (pushed.current) window.history.back()
    else setSheetOpen(false)
  }

  useEffect(() => {
    if (!sheetOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || !window.matchMedia(BELOW_LG).matches) return
      if (pushed.current) window.history.back()
      else setSheetOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sheetOpen])

  const sheetClosedOnPhone = below && !sheetOpen

  // Background art direction (public/images/auth-background*.png), optimized by next/image.
  const imageBase = { alt: "", fill: true, priority: true, sizes: "100vw" } as const
  const {
    props: { srcSet: desktopSrcSet, ...desktopRest },
  } = getImageProps({ ...imageBase, src: "/images/auth-background.png" })
  const {
    props: { srcSet: mobileSrcSet },
  } = getImageProps({ ...imageBase, src: "/images/auth-background-mobile.png" })
  const desktopBackground = { srcSet: desktopSrcSet, rest: desktopRest }
  const mobileBackground = { srcSet: mobileSrcSet }

  return (
    <div className="auth-root relative min-h-dvh lg:h-dvh lg:overflow-hidden" data-intro={intro ? "" : undefined}>
      {/* Full-screen photo behind everything (public/images/auth-background.png). */}
      <picture>
        <source media="(max-width: 767px)" srcSet={mobileBackground.srcSet} />
        <source media="(min-width: 768px)" srcSet={desktopBackground.srcSet} />
        <img {...desktopBackground.rest} alt="" className="-z-10 object-cover object-center" />
      </picture>

      {/* Solid so it stays visible over the photo: Tinta with a Lima icon in both themes; Lima with a Tinta icon on hover. */}
      <ThemeToggle
        round
        tooltip
        className={cn(
          "fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-40 size-12 md:size-12 lg:top-6 lg:right-6",
          "border-palette-papel/12 bg-palette-tinta text-highlight hover:scale-105 hover:border-transparent hover:bg-highlight hover:text-palette-tinta dark:border-palette-papel/12 dark:bg-palette-tinta dark:hover:bg-highlight",
          "shadow-[0_8px_24px_color-mix(in_oklab,var(--palette-tinta)_35%,transparent)] focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-5 [&_svg]:stroke-2",
          authMotion
        )}
      />

      {/* Phones: screen 1 (welcome), the "Voltar" pill, and screen 2 (the sheet, below). */}
      <MobileWelcome hidden={sheetOpen} onOpen={openSheet} />
      {/* Sheet open on a phone: tapping the photo closes it, and the logo above the sheet is the "back" button. */}
      <div aria-hidden onClick={closeSheet} className={cn("fixed inset-0 z-20 lg:hidden", !sheetOpen && "pointer-events-none")} />
      <div ref={logoAreaRef} className="pointer-events-none fixed inset-x-0 top-0 z-[25] flex h-[24dvh] items-center justify-center lg:hidden">
        <button
          type="button"
          onClick={closeSheet}
          inert={!sheetOpen}
          aria-label="Voltar para o início"
          className={cn(
            "rounded-xl p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            authMotion,
            sheetOpen ? "pointer-events-auto scale-100 opacity-100 delay-200" : "pointer-events-none scale-90 opacity-0"
          )}
        >
          <ThemedLogo className="h-10" />
        </button>
      </div>

      <div className="mx-auto flex min-h-dvh w-full flex-col lg:h-dvh lg:items-center lg:justify-center">
        <div
          ref={sheetRef}
          inert={sheetClosedOnPhone}
          aria-hidden={sheetClosedOnPhone ? true : undefined}
          // Drag-follow uses the same `translate` property as the open/closed classes, so releasing animates from where the finger left it.
          style={drag ? { translate: `0 ${drag}px`, transition: "none" } : undefined}
          onTouchStart={(event) => {
            if (!below) return
            const touch = event.touches[0]
            gesture.current = { startY: touch.clientY, lastY: touch.clientY, lastT: event.timeStamp, velocity: 0, scrollTop: event.currentTarget.scrollTop, dragging: false }
          }}
          onTouchMove={(event) => {
            if (!below) return
            const g = gesture.current
            const y = event.touches[0].clientY
            const dy = y - g.startY
            if (!g.dragging) {
              if (dy > 6 && g.scrollTop <= 0 && event.currentTarget.scrollTop <= 0) g.dragging = true
              else return
            }
            const dt = event.timeStamp - g.lastT
            if (dt > 0) g.velocity = (y - g.lastY) / dt
            g.lastY = y
            g.lastT = event.timeStamp
            setDrag(Math.max(0, dy))
          }}
          onTouchEnd={() => {
            const g = gesture.current
            if (!below || !g.dragging) return
            g.dragging = false
            // Past 100 px, or a quick flick down.
            const shouldClose = drag > 100 || (g.velocity > 0.5 && drag > 24)
            setDrag(0)
            if (shouldClose) closeSheet()
          }}
          className={cn(
            "relative flex flex-col",
            // Phones: bottom sheet over the photo (radius 32, slides up in 0.5 s).
            "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:mx-auto max-lg:max-h-[88dvh] max-lg:w-full max-lg:max-w-[560px] max-lg:overflow-y-auto max-lg:overscroll-y-contain max-lg:rounded-t-[32px] max-lg:bg-background max-lg:transition-[translate] max-lg:duration-500 max-lg:ease-[cubic-bezier(0.2,0.8,0.2,1)] max-lg:motion-reduce:transition-none",
            sheetOpen ? "max-lg:translate-y-0" : "max-lg:translate-y-full",
            // Desktop: the card. P = 24 px: card padding, and the gap between the panel and the form area. It enters once, on page load.
            "lg:mt-0 lg:grid lg:h-(--auth-ch) lg:w-(--auth-cw) lg:flex-none lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:gap-x-(--auth-p) lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-border lg:bg-transparent lg:p-(--auth-p)",
            "lg:animate-in lg:duration-[600ms] lg:ease-[cubic-bezier(0.2,0.8,0.2,1)] lg:fill-mode-backwards lg:fade-in lg:zoom-in-98 lg:slide-in-from-bottom-4"
          )}
        >
          {/* Phones: drag handle. Swiping the handle or the sheet down closes it. */}
          <div className="sticky top-0 z-10 flex h-6 shrink-0 touch-none items-center justify-center bg-background lg:hidden">
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-border" />
          </div>

          {/* Desktop: the transparent highlight panel slides between the halves. */}
          <div
            data-crossfade
            className={cn(
              // Same box as the form area, inset P (24 px) from the card. The solid frame is a huge background-colored shadow clipped by the card, so it follows the panel.
              "pointer-events-none absolute inset-y-(--auth-p) left-(--auth-p) hidden w-[calc(50%-1.5*var(--auth-p))] rounded-[20px] shadow-[0_0_0_100vmax_var(--background)] transition-transform duration-[550ms] lg:block motion-reduce:duration-0",
              EASE,
              signup ? "translate-x-[calc(100%+var(--auth-p))]" : "translate-x-0"
            )}
          >
            <HighlightPanel signup={signup} className="pointer-events-auto size-full" />
          </div>

          <FormPane active={signup} side="left">
            <SignUpForm />
          </FormPane>

          <FormPane active={!signup} side="right">
            <SlideSwap
              active={mode === "forgot" || mode === "reset" ? "second" : "first"}
              first={<SignInForm next={next} linkError={params.get("erro") === "link"} oauthError={params.get("error") === "oauth"} />}
              second={mode === "reset" ? <ResetPasswordForm /> : <ForgotPasswordForm />}
            />
          </FormPane>
        </div>
      </div>
    </div>
  )
}
