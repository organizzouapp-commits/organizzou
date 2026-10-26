"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUp } from "@/features/auth/actions"
import { signUpSchema, type SignUpInput } from "@/features/auth/schemas"

export function SignUpForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) })

  function onSubmit(values: SignUpInput) {
    setError(null)
    startTransition(async () => {
      const result = await signUp(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (result.needsEmailConfirmation) {
        setSentTo(values.email)
        return
      }
      router.replace("/hoje")
      router.refresh()
    })
  }

  if (sentTo) {
    return (
      <FormMessage kind="success">
        Enviamos um link de confirmação para {sentTo}. Abra o e-mail e toque no link para ativar sua
        conta.
      </FormMessage>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Nome</Label>
        <Input
          id="displayName"
          autoComplete="name"
          aria-invalid={Boolean(errors.displayName)}
          {...register("displayName")}
        />
        {errors.displayName ? (
          <FormMessage kind="error">{errors.displayName.message}</FormMessage>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? <FormMessage kind="error">{errors.email.message}</FormMessage> : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        <span className="text-[13px] leading-5 text-muted-foreground">Mínimo de 8 caracteres.</span>
        {errors.password ? <FormMessage kind="error">{errors.password.message}</FormMessage> : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <FormMessage kind="error">{errors.confirmPassword.message}</FormMessage>
        ) : null}
      </div>
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  )
}
