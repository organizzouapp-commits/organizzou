"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { ChevronLeftIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { ThemeToggle } from "@/components/organizzou/ThemeToggle"
import { cn } from "@/lib/utils"

import { authLinkClass, authMotion, R, rs } from "./auth-parts"
import { ForgotPasswordForm } from "./forgot-password-form"
import { ResetPasswordForm } from "./reset-password-form"
import { SignInForm } from "./sign-in-form"
import { SignUpForm } from "./sign-up-form"

type Mode = "login" | "signup" | "forgot" | "reset"
type Target = "login" | "signup"

function modeFor(pathname: string): Mode {
  if (pathname.startsWith("/cadastro")) return "signup"
  if (pathname.startsWith("/recuperar-senha")) return "forgot"
  if (pathname.startsWith("/redefinir-senha")) return "reset"
  return "login"
}

const COPY = {
  login: {
    badge: "Bom te ver de novo",
    headline: "Sua vida, organizada.",
    subtitle: "Entre para ver o seu dia.",
    steps: ["Veja seu dia", "Fale com o assistente", "Receba lembretes"],
  },
  signup: {
    badge: "Comece agora",
    headline: "Comece a se organizar",
    subtitle: "Três passos e pronto.",
    steps: ["Crie sua conta", "Conecte seu WhatsApp", "Organize seu dia"],
  },
} as const

type CopyKey = keyof typeof COPY

// One easing for every movement in the shell (DESIGN-SYSTEM §6).
const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]"

/** Tinta scrim (max 40%, heavier at the bottom) that keeps Papel text readable over the photo. */
const SCRIM = "bg-gradient-to-b from-palette-tinta/15 via-palette-tinta/25 to-palette-tinta/40"

const glass = "border border-palette-papel/12 bg-palette-papel/10 backdrop-blur-[16px]"

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

/** One logo per theme, swapped with CSS so there is no flash or hydration mismatch. Same size in both. */
function ThemedLogo({ className }: { className: string }) {
  return (
    <>
      <Image src="/brand/logo-preta.png" alt="Organizzou" width={3000} height={683} loading="eager" className={cn("hidden w-auto dark:block", className)} />
      <Image src="/brand/logo-branca.png" alt="Organizzou" width={3000} height={683} loading="eager" className={cn("block w-auto dark:hidden", className)} />
    </>
  )
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
    <div aria-hidden={!active} inert={!active} className={cn("col-start-1 row-start-1 flex flex-col gap-4", !active && "pointer-events-none")}>
      <span
        className={cn("inline-flex w-fit items-center rounded-full px-3 py-1 text-[13px] leading-5 font-medium text-palette-papel", glass, enter, reveal)}
        style={{ transitionDelay: "0ms", ...rs(1) }}
      >
        {copy.badge}
      </span>
      <h2
        className={cn("text-[40px] leading-[48px] font-semibold tracking-[-0.02em] text-palette-papel", enter, reveal)}
        style={{ transitionDelay: active ? "60ms" : "0ms", ...rs(2) }}
      >
        {copy.headline}
      </h2>
      <p className={cn("text-base leading-6 text-palette-papel/80", enter, reveal)} style={{ transitionDelay: active ? "120ms" : "0ms", ...rs(3) }}>
        {copy.subtitle}
      </p>
      <ol className="mt-4 grid grid-cols-3 gap-3">
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
                  "group/step flex min-h-32 w-full cursor-pointer flex-col justify-between gap-4 rounded-[20px] border p-4 text-left outline-none",
                  "hover:-translate-y-1 hover:border-highlight/40 focus-visible:-translate-y-1 focus-visible:border-highlight/40 focus-visible:ring-3 focus-visible:ring-ring/50",
                  "transition-all duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
                  isActive
                    ? "border-palette-papel/12 bg-highlight text-highlight-foreground"
                    : "border-palette-papel/12 bg-palette-papel/8 text-palette-papel/80 backdrop-blur-[16px] hover:bg-palette-papel/12 focus-visible:bg-palette-papel/12"
                )}
              >
                <span
                  className={cn(
                    "tabular flex size-8 items-center justify-center rounded-full border text-[14px] leading-5 font-semibold",
                    "transition-all duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
                    isActive
                      ? "border-transparent bg-highlight-foreground text-highlight"
                      : "border-palette-papel/40 group-hover/step:border-transparent group-hover/step:bg-highlight group-hover/step:text-highlight-foreground group-focus-visible/step:border-transparent group-focus-visible/step:bg-highlight group-focus-visible/step:text-highlight-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <span className="text-[15px] leading-5 font-medium">{label}</span>
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
    <aside aria-label="Organizzou" className={cn("relative flex flex-col justify-between gap-10 overflow-hidden rounded-[20px] p-7 text-palette-papel", className)}>
      {/* Transparent panel: the photo shows through; only the subtle scrim helps legibility. */}
      <span aria-hidden className={cn("pointer-events-none absolute inset-0", SCRIM)} />
      <div className={cn("relative", R)} style={rs(0)}>
        <ThemedLogo className="h-8" />
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
    <div inert={hidden} aria-hidden={hidden} className="fixed inset-0 z-10 flex flex-col text-palette-papel lg:hidden">
      <span aria-hidden className={cn("pointer-events-none absolute inset-0", SCRIM)} />
      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <div className={R} style={rs(0)}>
          <ThemedLogo className="h-10" />
        </div>
        <h2 className={cn("mt-2 text-[34px] leading-[42px] font-semibold tracking-[-0.02em]", R)} style={rs(1)}>
          Sua vida, organizada.
        </h2>
        <p className={cn("text-base leading-6 text-palette-papel/80", R)} style={rs(2)}>
          Tudo do seu dia em um só lugar.
        </p>
      </div>
      <div className={cn("relative grid h-[calc(72px+env(safe-area-inset-bottom))] grid-cols-2", R)} style={rs(3)}>
        <button
          type="button"
          onClick={() => onOpen("login")}
          className={cn(
            "pb-[env(safe-area-inset-bottom)] text-base leading-6 font-semibold text-palette-papel outline-none hover:bg-palette-papel/10 focus-visible:bg-palette-papel/10 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-palette-papel/15",
            authMotion
          )}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => onOpen("signup")}
          className={cn(
            "rounded-tl-[28px] bg-palette-tinta pb-[env(safe-area-inset-bottom)] text-base leading-6 font-semibold text-palette-papel outline-none hover:bg-palette-tinta/90 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]",
            "dark:bg-palette-papel dark:text-palette-tinta dark:hover:bg-palette-papel/90",
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
      <Link href="/termos" className={cn(authLinkClass, "hover:underline")}>
        Termos de uso
      </Link>
      <span aria-hidden>·</span>
      <Link href="/privacidade" className={cn(authLinkClass, "hover:underline")}>
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
        "relative flex-col px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] duration-[550ms] lg:row-start-1 lg:flex lg:px-7 lg:pt-7 lg:pb-0",
        side === "left" ? "lg:col-start-1" : "lg:col-start-2",
        active
          ? "flex opacity-100 lg:translate-x-0 max-lg:animate-in max-lg:duration-300 max-lg:fade-in"
          : cn("hidden lg:pointer-events-none lg:flex lg:opacity-0", side === "left" ? "lg:-translate-x-6" : "lg:translate-x-6")
      )}
    >
      <div className="flex flex-1 items-center justify-center py-4">{children}</div>
      <LegalLinks className="mt-6 lg:mt-0" />
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
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/hoje"

  // Phones: a direct visit shows the welcome screen; /cadastro, recovery, ?next= and the redirect after logout open the sheet.
  const [sheetOpen, setSheetOpen] = useState(() => mode !== "login" || params.has("next") || params.has("erro") || params.has("saiu"))
  const [intro, setIntro] = useState(true)
  const [drag, setDrag] = useState(0)
  const pushed = useRef(false)
  const touchStart = useRef(0)

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

  function openSheet(target: Target) {
    const path = target === "signup" ? "/cadastro" : "/entrar"
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

  return (
    <div className="relative min-h-dvh" data-intro={intro ? "" : undefined}>
      {/* Full-screen photo behind everything (public/images/auth-background.png). */}
      <Image src="/images/auth-background.png" alt="" fill priority sizes="100vw" className="-z-10 object-cover object-center" />

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
      <button
        type="button"
        onClick={closeSheet}
        inert={!sheetOpen}
        className={cn(
          "fixed top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-40 inline-flex h-11 items-center gap-1 rounded-full pr-4 pl-3 text-[15px] leading-6 font-semibold text-palette-papel outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden",
          glass,
          authMotion,
          sheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <ChevronLeftIcon aria-hidden strokeWidth={2} className="size-5" />
        Voltar
      </button>

      <div className="mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col lg:justify-center lg:px-6 lg:py-6">
        <div
          inert={sheetClosedOnPhone}
          aria-hidden={sheetClosedOnPhone ? true : undefined}
          style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
          className={cn(
            "relative flex flex-col",
            // Phones: bottom sheet over the photo (radius 32, slides up in 0.5 s).
            "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:mx-auto max-lg:max-h-[92dvh] max-lg:min-h-[72dvh] max-lg:w-full max-lg:max-w-[560px] max-lg:overflow-y-auto max-lg:rounded-t-[32px] max-lg:bg-background max-lg:transition-[translate] max-lg:duration-500 max-lg:ease-[cubic-bezier(0.2,0.8,0.2,1)] max-lg:motion-reduce:transition-none",
            sheetOpen ? "max-lg:translate-y-0" : "max-lg:translate-y-full",
            // Desktop: the card. P = 24 px: card padding, and the gap between the panel and the form area. It enters once, on page load.
            "lg:mt-0 lg:grid lg:min-h-[720px] lg:flex-none lg:grid-cols-2 lg:gap-x-6 lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-border lg:bg-transparent lg:p-6",
            "lg:animate-in lg:duration-[600ms] lg:ease-[cubic-bezier(0.2,0.8,0.2,1)] lg:fill-mode-backwards lg:fade-in lg:zoom-in-98 lg:slide-in-from-bottom-4"
          )}
        >
          {/* Phones: drag handle. Swiping down closes the sheet. */}
          <div
            className="sticky top-0 z-10 flex h-8 shrink-0 touch-none items-center justify-center bg-background lg:hidden"
            onTouchStart={(event) => {
              touchStart.current = event.touches[0].clientY
            }}
            onTouchMove={(event) => setDrag(Math.max(0, event.touches[0].clientY - touchStart.current))}
            onTouchEnd={() => {
              const shouldClose = drag > 100
              setDrag(0)
              if (shouldClose) closeSheet()
            }}
          >
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-border" />
          </div>

          {/* Desktop: the transparent highlight panel slides between the halves. */}
          <div
            data-crossfade
            className={cn(
              // Same box as the form area, inset P (24 px) from the card. The solid frame is a huge background-colored shadow clipped by the card, so it follows the panel.
              "pointer-events-none absolute inset-y-6 left-6 hidden w-[calc(50%-36px)] rounded-[20px] shadow-[0_0_0_100vmax_var(--background)] transition-transform duration-[550ms] lg:block motion-reduce:duration-0",
              EASE,
              signup ? "translate-x-[calc(100%+24px)]" : "translate-x-0"
            )}
          >
            <HighlightPanel signup={signup} className="pointer-events-auto size-full" />
          </div>

          <FormPane active={signup} side="left">
            <SignUpForm />
          </FormPane>

          <FormPane active={!signup} side="right">
            {mode === "forgot" ? (
              <div key="forgot" className="flex w-full animate-in justify-center duration-300 fade-in">
                <ForgotPasswordForm />
              </div>
            ) : mode === "reset" ? (
              <div key="reset" className="flex w-full animate-in justify-center duration-300 fade-in">
                <ResetPasswordForm />
              </div>
            ) : (
              <div key="login" className="flex w-full justify-center">
                <SignInForm next={next} linkError={params.get("erro") === "link"} />
              </div>
            )}
          </FormPane>
        </div>
      </div>
    </div>
  )
}
