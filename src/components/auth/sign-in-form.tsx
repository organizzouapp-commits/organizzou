"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/features/auth/actions"
import { signInSchema, type SignInInput } from "@/features/auth/schemas"

import { authButtonClass, authInputClass, GoogleButton, OrDivider, PasswordInput } from "./auth-parts"

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
    <div className="flex w-full max-w-[420px] flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em]">Entrar</h1>
        <p className="text-base leading-6 text-muted-foreground">Use seu e-mail e senha para acessar o Organizzou.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Senha</Label>
            <Link
              href="/recuperar-senha"
              className="text-[13px] leading-5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Esqueci a senha
            </Link>
          </div>
          <PasswordInput id="login-password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
          {errors.password ? <FormMessage kind="error">{errors.password.message}</FormMessage> : null}
        </div>
        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
        <Button type="submit" size="lg" className={authButtonClass} disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <OrDivider />
      <GoogleButton next={next} />

      <p className="text-[15px] leading-6 text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-foreground underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
