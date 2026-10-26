"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, CircleIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { resetPassword } from "@/features/auth/actions"
import { PASSWORD_RULES, resetPasswordSchema, type ResetPasswordInput } from "@/features/auth/schemas"
import { cn } from "@/lib/utils"

import { authButtonClass, PasswordInput } from "./auth-parts"

export function ResetPasswordForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) })
  const password = useWatch({ control, name: "password" }) ?? ""

  function onSubmit(values: ResetPasswordInput) {
    setError(null)
    startTransition(async () => {
      const result = await resetPassword(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success("Senha alterada.")
      router.replace("/hoje")
      router.refresh()
    })
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em]">Criar nova senha</h1>
        <p className="text-base leading-6 text-muted-foreground">Escolha uma senha que você não use em outros lugares.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-password">Nova senha</Label>
          <PasswordInput id="reset-password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password)
              return (
                <li key={rule.key} className={cn("flex items-center gap-1.5 text-[13px] leading-5", ok ? "text-foreground" : "text-muted-foreground")}>
                  {ok ? <CheckIcon aria-hidden strokeWidth={2} className="size-3.5" /> : <CircleIcon aria-hidden strokeWidth={1.75} className="size-3.5" />}
                  {rule.label}
                </li>
              )
            })}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-confirm">Confirmar nova senha</Label>
          <PasswordInput id="reset-confirm" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
          {errors.confirmPassword ? <FormMessage kind="error">{errors.confirmPassword.message}</FormMessage> : null}
        </div>
        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
        <Button type="submit" size="lg" className={authButtonClass} disabled={pending}>
          {pending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  )
}
