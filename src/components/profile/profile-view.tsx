"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { HatchedProgress } from "@/components/finance/parts"
import { FormMessage } from "@/components/organizzou/FormMessage"
import { usePlan } from "@/components/organizzou/plan-context"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPassword } from "@/features/auth/actions"
import { maskPhone, resetPasswordSchema, type ResetPasswordInput } from "@/features/auth/schemas"
import { updateProfile } from "@/features/settings/actions"
import { canChangePassword, isProfileDirty, memberSince, passwordRequirements, passwordStrength, profileInitials } from "@/features/settings/profile-helpers"
import { cn } from "@/lib/utils"

type ProfileViewProps = { displayName: string; email: string; phone: string; createdAt?: string }

const chipClass = "tabular inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-foreground/25 px-2.5 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"

/** The card on top of the Perfil tab: avatar with initials, name, e-mail, the plan and the member-since chips, and the (not yet available) photo button. */
export function ProfileCard({ displayName, email, createdAt }: ProfileViewProps) {
  const { pro, definition } = usePlan()
  const since = memberSince(createdAt)
  return (
    <section aria-label="Seu perfil" data-testid="profile-card" className="flex flex-col gap-4 rounded-[24px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar className="size-20 shrink-0">
          <AvatarFallback className="text-2xl font-semibold">{profileInitials(displayName, email)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="truncate text-[20px] leading-7 font-semibold">{displayName || "Sem nome"}</p>
          <p className="truncate text-[14px] leading-5 text-muted-foreground">{email}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span data-chip="plan" className={cn(chipClass, pro && "border-transparent bg-highlight font-medium text-highlight-foreground")}>
              {definition.name}
            </span>
            {since ? (
              <span data-chip="since" className={chipClass}>
                Membro desde {since}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 max-sm:border-t max-sm:border-border max-sm:pt-3">
        <Button type="button" variant="outline" disabled className="h-11 rounded-full px-5 md:h-11 max-sm:flex-1">
          Alterar foto
        </Button>
        <SoonBadge />
      </div>
    </section>
  )
}

const FIELD = "h-11 rounded-[12px] text-[15px] md:h-11 md:text-[15px]"

/** "Seus dados": name, e-mail (read-only), phone with the fixed +55. "Salvar" is enabled only after something changed. */
export function ProfileForm({ displayName, email, phone }: ProfileViewProps) {
  const [name, setName] = useState(displayName)
  const [phoneValue, setPhoneValue] = useState(phone ? maskPhone(phone) : "")
  const [saved, setSaved] = useState({ name: displayName, phone: phone ? maskPhone(phone) : "" })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const dirty = isProfileDirty(saved, { name, phone: phoneValue })

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!dirty || pending) return
    setError(null)
    startTransition(async () => {
      const result = await updateProfile({ displayName: name, phone: phoneValue })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSaved({ name, phone: phoneValue })
      toast.success("Alterações salvas.")
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-name">Nome</Label>
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} className={FIELD} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-email">E-mail</Label>
        <Input id="profile-email" value={email} readOnly disabled aria-describedby="profile-email-help" className={cn(FIELD, "opacity-60")} />
        <p id="profile-email-help" className="text-[13px] leading-5 text-muted-foreground">
          O e-mail não pode ser alterado aqui.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-phone">Telefone</Label>
        <div className="flex gap-2">
          <span className="flex h-11 w-16 shrink-0 items-center justify-center rounded-[12px] border border-input text-[15px] text-muted-foreground dark:bg-input/30" aria-label="Código do Brasil">
            +55
          </span>
          <Input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 91234-5678" value={phoneValue} onChange={(e) => setPhoneValue(maskPhone(e.target.value))} className={FIELD} />
        </div>
      </div>
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      <div className="flex justify-end">
        <Button type="submit" data-testid="save-profile" disabled={!dirty || pending} className="h-11 rounded-full bg-highlight px-6 text-highlight-foreground hover:bg-highlight/90 md:h-11">
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  )
}

/** "Alterar senha": strength bar, a live checklist and a button that waits for every rule and a matching confirmation. */
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
  const confirm = useWatch({ control, name: "confirmPassword" }) ?? ""
  const strength = passwordStrength(password)
  const mismatch = confirm !== "" && confirm !== password

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
        <Input id="new-password" type="password" autoComplete="new-password" placeholder="Sua nova senha" aria-invalid={Boolean(errors.password)} className={FIELD} {...register("password")} />
        <div data-testid="password-strength" data-level={strength.level} className="flex flex-col gap-1.5">
          <HatchedProgress value={strength.percent} label={`Força da senha: ${strength.label}`} />
          <p className="text-[13px] leading-5 text-muted-foreground" aria-live="polite">
            Força: <span className="font-semibold text-foreground">{strength.label}</span>
          </p>
        </div>
        <ul aria-label="Requisitos da senha" className="flex flex-col gap-1.5">
          {passwordRequirements(password).map((rule) => (
            <li key={rule.key} data-met={rule.met} className={cn("flex items-center gap-2 text-[13px] leading-5", rule.met ? "text-foreground" : "text-muted-foreground")}>
              <span aria-hidden className={cn("flex size-[18px] shrink-0 items-center justify-center rounded-full border", rule.met ? "border-transparent bg-highlight text-highlight-foreground" : "border-border")}>
                {rule.met ? <CheckIcon strokeWidth={2.25} className="size-3" /> : null}
              </span>
              {rule.label}
              <span className="sr-only">{rule.met ? " (atendido)" : " (falta)"}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Confirmar nova senha</Label>
        <Input id="confirm-password" type="password" autoComplete="new-password" placeholder="Repita a senha" aria-invalid={mismatch || Boolean(errors.confirmPassword)} className={FIELD} {...register("confirmPassword")} />
        {mismatch ? <FormMessage kind="error">As senhas não são iguais.</FormMessage> : null}
      </div>
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      <Button type="submit" data-testid="change-password" disabled={!canChangePassword(password, confirm) || pending} className="h-11 w-full rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/90 md:h-11">
        {pending ? "Salvando…" : "Alterar senha"}
      </Button>
    </form>
  )
}
