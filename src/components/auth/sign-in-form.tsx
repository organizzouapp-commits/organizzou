"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { LoadingOverlay } from "@/components/organizzou/loading-overlay"
import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/features/auth/actions"
import { cn } from "@/lib/utils"
import { signInSchema, type SignInInput } from "@/features/auth/schemas"

import { AuthLink, authButtonClass, authInputClass, authLabelClass, authLinkClass, GoogleButton, OrDivider, PasswordInput, R, rs } from "./auth-parts"

export function SignInForm({ next, linkError, oauthError }: { next: string; linkError?: boolean; oauthError?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // After a successful login the loading logo covers the screen until the dashboard takes over.
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(
    oauthError
      ? "Não foi possível entrar com o Google. Tente de novo."
      : linkError
        ? "O link é inválido ou expirou. Entre com sua senha ou peça um novo link."
        : null
  )
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) })

  function onSubmit(values: SignInInput) {
    setError(null)
    startTransition(async () => {
      const result = await signIn(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setLeaving(true)
      router.replace(next)
      router.refresh()
    })
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-(--auth-gap)">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className={cn("text-(length:--auth-title) leading-[1.25] font-semibold tracking-[-0.02em]", R)} style={rs(0)}>
          Entrar
        </h1>
        <p className={cn("text-(length:--auth-sub) leading-snug text-muted-foreground", R)} style={rs(1)}>
          Use seu e-mail e senha para acessar o Organizzou.
        </p>
      </div>

      {leaving ? <LoadingOverlay /> : null}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-(--auth-gap)">
        <div className={cn("flex flex-col gap-1.5", R)} style={rs(2)}>
          <Label className={authLabelClass} htmlFor="login-email">E-mail</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="Seu e-mail aqui"
            className={authInputClass}
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
          {errors.email ? <FormMessage kind="error">{errors.email.message}</FormMessage> : null}
        </div>
        <div className={cn("flex flex-col gap-1.5", R)} style={rs(3)}>
          <div className="flex items-center justify-between">
            <Label className={authLabelClass} htmlFor="login-password">Senha</Label>
            <AuthLink href="/recuperar-senha" className={cn(authLinkClass, "text-[13px] leading-5 text-muted-foreground hover:text-foreground hover:underline")}>
              Esqueci a senha
            </AuthLink>
          </div>
          <PasswordInput id="login-password" placeholder="Sua senha aqui" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
          {errors.password ? <FormMessage kind="error">{errors.password.message}</FormMessage> : null}
        </div>
        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
        <Button type="submit" size="xl" className={cn(authButtonClass, R)} style={rs(4)} disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <div className={R} style={rs(5)}>
        <OrDivider />
      </div>
      <div className={R} style={rs(6)}>
        <GoogleButton next={next} />
      </div>

      <p className={cn("text-center text-(length:--auth-text) leading-6 text-muted-foreground", R)} style={rs(7)}>
        Ainda não tem conta?{" "}
        <AuthLink href="/cadastro" className={cn(authLinkClass, "font-medium text-foreground underline")}>
          Criar conta
        </AuthLink>
      </p>
    </div>
  )
}
