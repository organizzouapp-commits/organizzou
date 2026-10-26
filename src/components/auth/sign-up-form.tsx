"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, CircleIcon } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUp } from "@/features/auth/actions"
import { maskPhone, PASSWORD_RULES, signUpSchema, type SignUpInput } from "@/features/auth/schemas"
import { cn } from "@/lib/utils"

import { authButtonClass, authInputClass, authLinkClass, GoogleButton, OrDivider, PasswordInput } from "./auth-parts"

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
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema), defaultValues: { phone: "" } })
  const password = useWatch({ control, name: "password" }) ?? ""

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

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-5">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em]">Criar conta</h1>
        <p className="text-base leading-6 text-muted-foreground">Leva menos de um minuto.</p>
      </div>

      {sentTo ? (
        <FormMessage kind="success">
          Enviamos um link de confirmação para {sentTo}. Abra o e-mail e toque no link para ativar sua conta.
        </FormMessage>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-name">Nome completo</Label>
            <Input id="signup-name" autoComplete="name" className={authInputClass} aria-invalid={Boolean(errors.fullName)} {...register("fullName")} />
            {errors.fullName ? <FormMessage kind="error">{errors.fullName.message}</FormMessage> : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-email">E-mail</Label>
            <Input
              id="signup-email"
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
            <Label htmlFor="signup-phone">Telefone</Label>
            <div className="flex gap-2">
              <span className="flex h-[52px] shrink-0 items-center rounded-xl border border-input px-4 text-base dark:bg-input/30" aria-label="Código do Brasil">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-password">Senha</Label>
            <PasswordInput id="signup-password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} aria-describedby="password-rules" {...register("password")} />
            <ul id="password-rules" className="grid grid-cols-2 gap-x-3 gap-y-1">
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(password)
                return (
                  <li key={rule.key} className={cn("flex items-center gap-1.5 text-[13px] leading-5", ok ? "text-foreground" : "text-muted-foreground")}>
                    {ok ? <CheckIcon aria-hidden strokeWidth={2} className="size-3.5" /> : <CircleIcon aria-hidden strokeWidth={1.75} className="size-3.5" />}
                    {rule.label}
                    <span className="sr-only">{ok ? " (atendido)" : " (pendente)"}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          {error ? <FormMessage kind="error">{error}</FormMessage> : null}
          <Button type="submit" size="xl" className={authButtonClass} disabled={pending}>
            {pending ? "Criando conta…" : "Criar conta"}
          </Button>
        </form>
      )}

      <OrDivider />
      <GoogleButton />

      <p className="text-center text-[15px] leading-6 text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/entrar" className={cn(authLinkClass, "font-medium text-foreground underline")}>
          Entrar
        </Link>
      </p>
    </div>
  )
}
