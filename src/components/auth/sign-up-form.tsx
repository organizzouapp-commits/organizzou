"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUp } from "@/features/auth/actions"
import { maskPhone, signUpSchema, type SignUpInput } from "@/features/auth/schemas"
import { cn } from "@/lib/utils"

import { AuthLink, authButtonClass, authInputClass, authLabelClass, authLinkClass, GoogleButton, OrDivider, PasswordInput, R, rs } from "./auth-parts"

export function SignUpForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    // Errors (the password rules show up as one message) appear after the field is left or the form is submitted.
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema), defaultValues: { phone: "" }, mode: "onTouched" })

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
      router.replace("/dashboard")
      router.refresh()
    })
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-(--auth-gap)">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className={cn("text-(length:--auth-title) leading-[1.25] font-semibold tracking-[-0.02em]", R)} style={rs(0)}>
          Criar conta
        </h1>
        <p className={cn("text-(length:--auth-sub) leading-snug text-muted-foreground", R)} style={rs(1)}>
          Leva menos de um minuto.
        </p>
      </div>

      {sentTo ? (
        <FormMessage kind="success">
          Enviamos um link de confirmação para {sentTo}. Abra o e-mail e toque no link para ativar sua conta.
        </FormMessage>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-(--auth-gap)">
          <div className={cn("flex flex-col gap-1.5", R)} style={rs(2)}>
            <Label className={authLabelClass} htmlFor="signup-name">Nome completo</Label>
            <Input id="signup-name" autoComplete="name" className={authInputClass} aria-invalid={Boolean(errors.fullName)} {...register("fullName")} />
            {errors.fullName ? <FormMessage kind="error">{errors.fullName.message}</FormMessage> : null}
          </div>
          <div className={cn("flex flex-col gap-1.5", R)} style={rs(3)}>
            <Label className={authLabelClass} htmlFor="signup-email">E-mail</Label>
            <Input
              id="signup-email"
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
          <div className={cn("flex flex-col gap-1.5", R)} style={rs(4)}>
            <Label className={authLabelClass} htmlFor="signup-phone">Telefone</Label>
            <div className="flex gap-2">
              <span className="flex h-(--auth-field) shrink-0 items-center rounded-xl border border-input px-4 text-base dark:bg-input/30" aria-label="Código do Brasil">
                +55
              </span>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    id="signup-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(11) 91234-5678"
                    className={authInputClass}
                    aria-invalid={Boolean(errors.phone)}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(e) => field.onChange(maskPhone(e.target.value))}
                  />
                )}
              />
            </div>
            {errors.phone ? <FormMessage kind="error">{errors.phone.message}</FormMessage> : null}
          </div>
          <div className={cn("flex flex-col gap-1.5", R)} style={rs(5)}>
            <Label className={authLabelClass} htmlFor="signup-password">Senha</Label>
            <PasswordInput id="signup-password" placeholder="Sua senha aqui" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
            {errors.password ? <FormMessage kind="error">{errors.password.message}</FormMessage> : null}
          </div>
          {error ? <FormMessage kind="error">{error}</FormMessage> : null}
          <Button type="submit" size="xl" className={cn(authButtonClass, R)} style={rs(6)} disabled={pending} aria-busy={pending}>
            {pending ? "Criando conta…" : "Criar conta"}
          </Button>
        </form>
      )}

      <div className={R} style={rs(7)}>
        <OrDivider />
      </div>
      <div className={R} style={rs(8)}>
        <GoogleButton />
      </div>

      <p className={cn("text-center text-(length:--auth-text) leading-6 text-muted-foreground", R)} style={rs(9)}>
        Já tem conta?{" "}
        <AuthLink href="/login" className={cn(authLinkClass, "font-medium text-foreground underline")}>
          Entrar
        </AuthLink>
      </p>
    </div>
  )
}
