"use client"

import { useEffect, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheckIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset } from "@/features/auth/actions"
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/auth/schemas"

import { cn } from "@/lib/utils"

import { AuthLink, authButtonClass, authInputClass, authLabelClass, authLinkClass, R, rs, SlideSwap } from "./auth-parts"

const RESEND_SECONDS = 60

/** Web inbox for the big providers; anything else falls back to the default mail app. */
function inboxUrl(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? ""
  if (domain === "gmail.com" || domain === "googlemail.com") return "https://mail.google.com/mail/u/0/#inbox"
  if (["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.com.br", "hotmail.com.br"].includes(domain)) return "https://outlook.live.com/mail/0/inbox"
  if (domain.startsWith("yahoo.")) return "https://mail.yahoo.com/"
  return "mailto:"
}

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  function send(values: ForgotPasswordInput, resend = false) {
    setError(null)
    startTransition(async () => {
      const result = await requestPasswordReset(values)
      if (!result.ok) {
        if (resend) toast.error(result.error)
        else setError(result.error)
        return
      }
      setSentTo(values.email)
      setCooldown(RESEND_SECONDS)
      if (resend) toast.success("E-mail reenviado.")
    })
  }

  const form = (
    <div className="flex w-full max-w-[420px] flex-col gap-(--auth-gap)">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className={cn("text-(length:--auth-title) leading-[1.25] font-semibold tracking-[-0.02em]", R)} style={rs(0)}>
          Recuperar senha
        </h1>
        <p className={cn("text-(length:--auth-sub) leading-snug text-muted-foreground", R)} style={rs(1)}>
          Informe seu e-mail e enviaremos um link para criar uma nova senha.
        </p>
      </div>
      <form onSubmit={handleSubmit((values) => send(values))} noValidate className={cn("flex flex-col gap-(--auth-gap)", R)} style={rs(2)}>
        <div className="flex flex-col gap-1.5">
          <Label className={authLabelClass} htmlFor="forgot-email">
            E-mail
          </Label>
          <Input
            id="forgot-email"
            type="email"
            placeholder="Seu e-mail aqui"
            autoComplete="email"
            inputMode="email"
            className={authInputClass}
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
          {errors.email ? <FormMessage kind="error">{errors.email.message}</FormMessage> : null}
        </div>
        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
        <Button type="submit" size="xl" className={authButtonClass} disabled={pending}>
          {pending ? "Enviando…" : "Enviar link"}
        </Button>
      </form>
      <p className={cn("text-center text-(length:--auth-text) leading-6", R)} style={rs(3)}>
        <AuthLink href="/entrar" className={cn(authLinkClass, "font-medium underline")}>
          Voltar para entrar
        </AuthLink>
      </p>
    </div>
  )

  const sent = (
    <div className="flex w-full max-w-[420px] flex-col items-center gap-(--auth-gap) text-center">
      <span
        aria-hidden
        className={cn(
          "flex size-[clamp(72px,11dvh,96px)] items-center justify-center rounded-full bg-highlight text-highlight-foreground",
          sentTo && "motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in motion-safe:zoom-in-50"
        )}
      >
        <MailCheckIcon strokeWidth={1.5} className="size-[45%]" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-(length:--auth-title) leading-[1.25] font-semibold tracking-[-0.02em]">Confira seu e-mail</h1>
        <p className="text-(length:--auth-sub) leading-snug text-muted-foreground">
          Enviamos um link para <strong className="font-semibold break-words text-foreground">{sentTo}</strong> para você criar uma nova senha. Se não encontrar, confira a caixa de spam.
        </p>
      </div>
      <Button asChild size="xl" className={authButtonClass}>
        <a href={sentTo ? inboxUrl(sentTo) : "#"} target="_blank" rel="noopener noreferrer">
          Abrir meu e-mail
        </a>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xl"
        className={cn(authButtonClass, "tabular")}
        disabled={cooldown > 0 || pending || !sentTo}
        onClick={() => sentTo && send({ email: sentTo }, true)}
      >
        {pending ? "Enviando…" : cooldown > 0 ? `Reenviar e-mail (${cooldown}s)` : "Reenviar e-mail"}
      </Button>
      <p className="text-center text-(length:--auth-text) leading-6">
        <AuthLink href="/entrar" className={cn(authLinkClass, "font-medium underline")}>
          ‹ Voltar para entrar
        </AuthLink>
      </p>
    </div>
  )

  return <SlideSwap active={sentTo ? "second" : "first"} first={form} second={sent} />
}
