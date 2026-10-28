"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, CircleIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { FormMessage } from "@/components/organizzou/FormMessage"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPassword } from "@/features/auth/actions"
import { maskPhone, PASSWORD_RULES, resetPasswordSchema, type ResetPasswordInput } from "@/features/auth/schemas"
import { updateProfile } from "@/features/settings/actions"
import { cn } from "@/lib/utils"

type ProfileViewProps = { displayName: string; email: string; phone: string }

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

export function ProfileForm({ displayName, email, phone }: ProfileViewProps) {
  const [name, setName] = useState(displayName)
  const [phoneValue, setPhoneValue] = useState(phone ? maskPhone(phone) : "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateProfile({ displayName: name, phone: phoneValue })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success("Perfil salvo.")
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-20">
          <AvatarFallback className="text-2xl font-semibold">{initials(name || email)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-[17px] leading-6 font-semibold">{name || "Sem nome"}</p>
          <p className="truncate text-[13px] leading-5 text-muted-foreground">{email}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled>
              Alterar foto
            </Button>
            <SoonBadge />
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-name">Nome</Label>
          <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-email">E-mail</Label>
          <Input id="profile-email" value={email} readOnly disabled />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-phone">Telefone (WhatsApp)</Label>
          <div className="flex gap-2">
            <span className="flex h-11 shrink-0 items-center rounded-lg border border-input px-3 text-base md:h-9 md:text-sm dark:bg-input/30" aria-label="Código do Brasil">
              +55
            </span>
            <Input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(11) 91234-5678"
              value={phoneValue}
              onChange={(e) => setPhoneValue(maskPhone(e.target.value))}
            />
          </div>
        </div>
        {error ? <FormMessage kind="error">{error}</FormMessage> : null}
        <Button type="submit" className="self-start" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </div>
  )
}

export function PasswordForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } })
  const password = useWatch({ control, name: "password" }) ?? ""

  function onSubmit(values: ResetPasswordInput) {
    setError(null)
    startTransition(async () => {
      const result = await resetPassword(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      reset()
      toast.success("Senha alterada.")
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <Input id="new-password" type="password" autoComplete="new-password" placeholder="Sua nova senha" aria-invalid={Boolean(errors.password)} {...register("password")} />
        <ul className="grid grid-cols-1 gap-y-1 @min-[560px]:grid-cols-2 gap-x-3">
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
        <Label htmlFor="confirm-password">Confirmar nova senha</Label>
        <Input id="confirm-password" type="password" autoComplete="new-password" placeholder="Repita a senha" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
        {errors.confirmPassword ? <FormMessage kind="error">{errors.confirmPassword.message}</FormMessage> : null}
      </div>
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      <Button type="submit" className="self-start" disabled={pending}>
        {pending ? "Salvando…" : "Alterar senha"}
      </Button>
    </form>
  )
}

export function ProfileView(props: ProfileViewProps) {
  return (
    <Bento>
      <BentoCard title="Seus dados" className="col-span-12 @min-[900px]:col-span-7">
        <ProfileForm {...props} />
      </BentoCard>
      <BentoCard title="Alterar senha" className="col-span-12 @min-[900px]:col-span-5">
        <PasswordForm />
      </BentoCard>
    </Bento>
  )
}
