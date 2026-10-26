"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset } from "@/features/auth/actions"
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/auth/schemas"

import { cn } from "@/lib/utils"

import { AuthLink, authButtonClass, authInputClass, authLinkClass, R, rs } from "./auth-parts"

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  function onSubmit(values: ForgotPasswordInput) {
    setError(null)
    startTransition(async () => {
      const result = await requestPasswordReset(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSent(true)
    })
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className={cn("text-[28px] leading-9 font-semibold tracking-[-0.02em]", R)} style={rs(0)}>
          Recuperar senha
        </h1>
        <p className={cn("text-base leading-6 text-muted-foreground", R)} style={rs(1)}>
          Informe seu e-mail e enviaremos um link para criar uma nova senha.
        </p>
      </div>

      {sent ? (
        <FormMessage kind="success">
          Se esse e-mail tiver uma conta, enviamos um link para criar uma nova senha. Confira também a caixa de spam.
        </FormMessage>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className={cn("flex flex-col gap-5", R)} style={rs(2)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="forgot-email">E-mail</Label>
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
      )}

      <p className={cn("text-center text-[15px] leading-6", R)} style={rs(3)}>
        <AuthLink href="/entrar" className={cn(authLinkClass, "font-medium underline")}>
          Voltar para entrar
        </AuthLink>
      </p>
    </div>
  )
}
