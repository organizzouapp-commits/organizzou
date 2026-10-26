"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/features/auth/actions"
import { cn } from "@/lib/utils"
import { signInSchema, type SignInInput } from "@/features/auth/schemas"

import { AuthLink, authButtonClass, authInputClass, authLinkClass, GoogleButton, OrDivider, PasswordInput, R, rs } from "./auth-parts"

export function SignInForm({ next, linkError }: { next: string; linkError?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(
    linkError ? "O link é inválido ou expirou. Entre com sua senha ou peça um novo link." : null
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
      router.replace(next)
      router.refresh()
    })
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className={cn("text-[28px] leading-9 font-semibold tracking-[-0.02em]", R)} style={rs(0)}>
          Entrar
        </h1>
        <p className={cn("text-base leading-6 text-muted-foreground", R)} style={rs(1)}>
          Use seu e-mail e senha para acessar o Organizzou.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <div className={cn("flex flex-col gap-2", R)} style={rs(2)}>
          <Label htmlFor="login-email">E-mail</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="voce@exemplo.com"
            className={authInputClass}
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
          {errors.email ? <FormMessage kind="error">{errors.email.message}</FormMessage> : null}
        </div>
        <div className={cn("flex flex-col gap-2", R)} style={rs(3)}>
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Senha</Label>
            <AuthLink href="/recuperar-senha" className={cn(authLinkClass, "text-[13px] leading-5 text-muted-foreground hover:text-foreground hover:underline")}>
              Esqueci a senha
            </AuthLink>
          </div>
          <PasswordInput id="login-password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
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

      <p className={cn("text-center text-[15px] leading-6 text-muted-foreground", R)} style={rs(7)}>
        Ainda não tem conta?{" "}
        <AuthLink href="/cadastro" className={cn(authLinkClass, "font-medium text-foreground underline")}>
          Criar conta
        </AuthLink>
      </p>
    </div>
  )
}
