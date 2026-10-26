"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { Logo } from "@/components/organizzou/Logo"
import { ThemeToggle } from "@/components/organizzou/ThemeToggle"
import { cn } from "@/lib/utils"

import { authLinkClass, authMotion } from "./auth-parts"
import { ForgotPasswordForm } from "./forgot-password-form"
import { ResetPasswordForm } from "./reset-password-form"
import { SignInForm } from "./sign-in-form"
import { SignUpForm } from "./sign-up-form"

type Mode = "login" | "signup" | "forgot" | "reset"

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
  return (
    <div aria-hidden={!active} inert={!active} className={cn("col-start-1 row-start-1 flex flex-col gap-4", !active && "pointer-events-none")}>
      <span className={cn("inline-flex w-fit items-center rounded-full px-3 py-1 text-[13px] leading-5 font-medium text-palette-papel", glass, enter)}>
        {copy.badge}
      </span>
      <h2 className={cn("text-[40px] leading-[48px] font-semibold tracking-[-0.02em] text-palette-papel", enter)} style={{ transitionDelay: active ? "60ms" : "0ms" }}>
        {copy.headline}
      </h2>
      <p className={cn("text-base leading-6 text-palette-papel/80", enter)} style={{ transitionDelay: active ? "120ms" : "0ms" }}>
        {copy.subtitle}
      </p>
      <ol className="mt-4 grid grid-cols-3 gap-3">
        {copy.steps.map((label, index) => {
          const isActive = index === activeStep
          return (
            // Entrance: fade + 8 px slide, staggered 60 ms. The hover lift lives on the inner button.
            <li key={label} className={enter} style={{ transitionDelay: active ? `${180 + index * 60}ms` : "0ms" }}>
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
      <div className="relative">
        {/* One logo per theme, swapped with CSS so there is no flash or hydration mismatch. Same size in both. */}
        <Image src="/brand/logo-preta.png" alt="Organizzou" width={3000} height={683} className="hidden h-8 w-auto dark:block" />
        <Image src="/brand/logo-branca.png" alt="Organizzou" width={3000} height={683} className="block h-8 w-auto dark:hidden" />
      </div>
      <div className="relative grid">
        <HighlightCopy copyKey="login" active={!signup} activeStep={steps.login} onStep={(i) => setSteps((s) => ({ ...s, login: i }))} />
        <HighlightCopy copyKey="signup" active={signup} activeStep={steps.signup} onStep={(i) => setSteps((s) => ({ ...s, signup: i }))} />
      </div>
    </aside>
  )
}

/** Mobile hero: logo, theme toggle, centered headline and the "Entrar | Criar conta" segmented control. */
function MobileHero({ mode }: { mode: Mode }) {
  const copy = mode === "signup" ? COPY.signup : COPY.login
  const items = [
    { href: "/entrar", label: "Entrar", on: mode === "login" },
    { href: "/cadastro", label: "Criar conta", on: mode === "signup" },
  ]
  return (
    // Inset look: P = 16 px margin, radius 24. The solid frame around the photo window is a huge Tinta/Papel shadow clipped by the page.
    <header className="relative mx-4 mt-[max(1rem,env(safe-area-inset-top))] flex min-h-[max(300px,38dvh)] flex-col justify-between gap-6 rounded-[24px] px-5 pt-5 pb-12 text-palette-papel shadow-[0_0_0_100vmax_var(--background)] lg:hidden">
      <span aria-hidden className={cn("pointer-events-none absolute inset-0 rounded-[24px]", SCRIM)} />
      <div className="relative flex items-center justify-between">
        <Logo tone="on-dark" className="h-8" />
      </div>
      <div key={mode === "signup" ? "signup" : "login"} className="relative flex animate-in flex-col items-center gap-2 text-center duration-300 fade-in slide-in-from-bottom-2">
        <h2 className="text-[28px] leading-9 font-semibold tracking-[-0.02em]">{copy.headline}</h2>
        <p className="text-[15px] leading-6 text-palette-papel/80">{copy.subtitle}</p>
      </div>
      <nav aria-label="Entrar ou criar conta" className={cn("relative grid grid-cols-2 gap-1 rounded-full p-1", glass)}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.on ? "page" : undefined}
            className={cn(
              "flex h-11 items-center justify-center rounded-full text-[15px] leading-6 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              authMotion,
              item.on ? "bg-highlight text-highlight-foreground" : "text-palette-papel hover:bg-palette-papel/10"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Informações legais" className={cn("flex justify-center gap-4 text-[13px] leading-5 text-muted-foreground", className)}>
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

/** One side of the card: solid form area with the theme toggle (top-right) and the legal links (bottom, centered). */
function FormPane({ active, side, children }: { active: boolean; side: "left" | "right"; children: React.ReactNode }) {
  return (
    <section
      data-crossfade
      aria-hidden={!active}
      inert={!active}
      className={cn(
        authMotion,
        // Mobile P = 16 px; desktop panes use the panel's 40 px inner padding.
        "relative flex-col px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))] duration-[550ms] lg:row-start-1 lg:flex lg:px-7 lg:pt-7 lg:pb-0",
        side === "left" ? "lg:col-start-1" : "lg:col-start-2",
        active
          ? cn("flex opacity-100 lg:translate-x-0 max-lg:animate-in max-lg:duration-300 max-lg:fade-in", side === "left" ? "max-lg:slide-in-from-left-6" : "max-lg:slide-in-from-right-6")
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

  const nextParam = params.get("next")
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/hoje"

  return (
    <div className="relative min-h-dvh">
      {/* Full-screen photo behind everything (public/images/auth-background.png). */}
      <Image src="/images/auth-background.png" alt="" fill priority sizes="100vw" className="-z-10 object-cover object-center" />

      {/* Floating glass theme toggle, fixed to the viewport corner (outside the card). */}
      <ThemeToggle
        round
        className={cn(
          "fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-40 size-11 backdrop-blur-[16px] md:size-11 lg:top-6 lg:right-6",
          "border-palette-tinta/12 bg-palette-tinta/6 hover:bg-palette-tinta/12 dark:border-palette-papel/12 dark:bg-palette-papel/8 dark:hover:bg-palette-papel/12",
          authMotion
        )}
      />

      <div className="mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col lg:justify-center lg:px-6 lg:py-6">
        <MobileHero mode={mode} />

        <div
          className={cn(
            "relative -mt-6 flex flex-1 flex-col rounded-t-[28px] bg-background",
            // P = 16 px: card padding, and the gap between the panel and the form area.
            "lg:mt-0 lg:grid lg:min-h-[720px] lg:flex-none lg:grid-cols-2 lg:gap-x-4 lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-border lg:bg-transparent lg:p-4"
          )}
        >
          {/* Desktop: the transparent highlight panel slides between the halves. */}
          <div
            data-crossfade
            className={cn(
              // Same box as the form area, inset P (16 px) from the card. The solid frame is a huge background-colored shadow clipped by the card, so it follows the panel.
              "pointer-events-none absolute inset-y-4 left-4 hidden w-[calc(50%-24px)] rounded-[20px] shadow-[0_0_0_100vmax_var(--background)] transition-transform duration-[550ms] lg:block motion-reduce:duration-0",
              EASE,
              signup ? "translate-x-[calc(100%+16px)]" : "translate-x-0"
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
