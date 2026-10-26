"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { Logo } from "@/components/organizzou/Logo"
import { ThemeToggle } from "@/components/organizzou/ThemeToggle"
import { cn } from "@/lib/utils"

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
  login: { badge: "Bom te ver de novo", headline: "Sua vida, organizada.", subtitle: "Entre para ver o seu dia." },
  signup: { badge: "Comece agora", headline: "Comece a se organizar", subtitle: "Três passos e pronto." },
} as const

const STEPS = ["Crie sua conta", "Conecte seu WhatsApp", "Organize seu dia"]

// One easing for every movement in the shell (DESIGN-SYSTEM §6).
const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]"

function HighlightCopy({ copy, active, compact }: { copy: (typeof COPY)[keyof typeof COPY]; active: boolean; compact?: boolean }) {
  return (
    <div
      data-crossfade
      aria-hidden={!active}
      className={cn(
        "col-start-1 row-start-1 flex flex-col gap-4 transition-opacity duration-500",
        active ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <span className="inline-flex w-fit items-center rounded-full bg-palette-papel/10 px-3 py-1 text-[13px] leading-5 font-medium text-palette-papel">
        {copy.badge}
      </span>
      <h2 className={cn("font-semibold tracking-[-0.02em] text-palette-papel", compact ? "text-[28px] leading-9" : "text-[40px] leading-[48px]")}>
        {copy.headline}
      </h2>
      <p className="text-base leading-6 text-palette-papel/70">{copy.subtitle}</p>
      {compact ? null : (
        <ol className="mt-4 grid grid-cols-3 gap-3">
          {STEPS.map((label, index) => {
            const activeStep = index === 0
            return (
              <li
                key={label}
                className={cn(
                  "flex min-h-32 flex-col justify-between gap-4 rounded-[20px] p-4",
                  activeStep ? "bg-highlight text-highlight-foreground" : "bg-palette-papel/8 text-palette-papel/70"
                )}
                aria-current={activeStep ? "step" : undefined}
              >
                <span
                  className={cn(
                    "tabular flex size-8 items-center justify-center rounded-full text-[14px] leading-5 font-semibold",
                    activeStep ? "bg-highlight-foreground text-highlight" : "border border-palette-papel/40"
                  )}
                >
                  {index + 1}
                </span>
                <span className="text-[15px] leading-5 font-medium">{label}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function HighlightPanel({ mode, className }: { mode: Mode; className?: string }) {
  const signup = mode === "signup"
  return (
    <aside
      aria-label="Organizzou"
      className={cn(
        "relative flex flex-col justify-between gap-10 overflow-hidden rounded-[24px] bg-palette-tinta p-6 text-palette-papel dark:bg-palette-grafite lg:p-10",
        className
      )}
    >
      {/* Soft Lima glow: the only decoration, 10–15% opacity. */}
      <span aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-highlight/15 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-highlight/10 blur-3xl" />

      <div className="relative">
        <Logo tone="on-dark" className="h-9" />
      </div>
      <div className="relative grid">
        <HighlightCopy copy={COPY.login} active={!signup} compact={false} />
        <HighlightCopy copy={COPY.signup} active={signup} compact={false} />
      </div>
    </aside>
  )
}

function CompactHeader({ mode }: { mode: Mode }) {
  const copy = mode === "signup" ? COPY.signup : COPY.login
  return (
    <header className="relative flex flex-col gap-6 overflow-hidden rounded-[24px] bg-palette-tinta p-6 text-palette-papel dark:bg-palette-grafite lg:hidden">
      <span aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-highlight/15 blur-3xl" />
      <div className="relative">
        <Logo tone="on-dark" className="h-8" />
      </div>
      <div key={mode === "signup" ? "signup" : "login"} className="relative flex animate-in flex-col gap-2 duration-300 fade-in">
        <h2 className="text-[26px] leading-8 font-semibold tracking-[-0.02em]">{copy.headline}</h2>
        <p className="text-[15px] leading-6 text-palette-papel/70">{copy.subtitle}</p>
      </div>
    </header>
  )
}

export function AuthShell() {
  const pathname = usePathname()
  const params = useSearchParams()
  const mode = modeFor(pathname)
  const signup = mode === "signup"

  const nextParam = params.get("next")
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/hoje"

  const paneBase = cn(
    "items-center justify-center px-0 py-4 transition-[opacity,transform] duration-[550ms] lg:flex lg:px-10 lg:py-10",
    EASE
  )

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col justify-center gap-6 px-4 py-6 lg:px-6 lg:py-10">
      <div
        className={cn(
          "relative flex flex-col gap-8 lg:grid lg:min-h-[720px] lg:grid-cols-2 lg:gap-0 lg:rounded-[28px] lg:border lg:border-border lg:bg-background lg:p-3"
        )}
      >
        <CompactHeader mode={mode} />

        {/* Desktop: the highlight panel slides between the halves. */}
        <div
          data-crossfade
          className={cn(
            "pointer-events-none absolute top-3 bottom-3 left-3 hidden w-[calc(50%-12px)] transition-transform duration-[550ms] lg:block motion-reduce:duration-0",
            EASE,
            signup ? "translate-x-full" : "translate-x-0"
          )}
        >
          <HighlightPanel mode={mode} className="pointer-events-auto size-full" />
        </div>

        {/* Left half: sign-up form. */}
        <section
          data-crossfade
          aria-hidden={!signup}
          inert={!signup}
          className={cn(
            paneBase,
            "lg:col-start-1 lg:row-start-1",
            signup ? "flex opacity-100 lg:translate-x-0" : "hidden lg:flex lg:pointer-events-none lg:-translate-x-6 lg:opacity-0"
          )}
        >
          <SignUpForm />
        </section>

        {/* Right half: sign in, or password recovery. */}
        <section
          data-crossfade
          aria-hidden={signup}
          inert={signup}
          className={cn(
            paneBase,
            "lg:col-start-2 lg:row-start-1",
            !signup ? "flex opacity-100 lg:translate-x-0" : "hidden lg:flex lg:pointer-events-none lg:translate-x-6 lg:opacity-0"
          )}
        >
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
        </section>
      </div>
      <footer className="flex items-center justify-between gap-4 text-[13px] leading-5 text-muted-foreground">
        <nav aria-label="Informações legais" className="flex gap-4">
          <Link href="/termos" className="underline-offset-4 hover:text-foreground hover:underline">
            Termos de uso
          </Link>
          <Link href="/privacidade" className="underline-offset-4 hover:text-foreground hover:underline">
            Política de privacidade
          </Link>
        </nav>
        <ThemeToggle round />
      </footer>
    </div>
  )
}
