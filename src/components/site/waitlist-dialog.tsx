"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, ChevronRightIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { maskPhone } from "@/features/auth/schemas"
import { joinWaitlist } from "@/features/waitlist/actions"
import { waitlistSchema, type WaitlistInput } from "@/features/waitlist/schemas"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const MOTION = "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
const inputClass = cn("h-[52px] rounded-xl px-4 py-0 text-base md:h-[52px] md:text-base", MOTION)

const TITLE = "Em breve!"
const DESCRIPTION = "Deixe seu contato e avisamos você em primeira mão quando o Organizzou for lançado."

function WaitlistForm({ onClose }: { onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<null | "new" | "already">(null)
  const {
    register,
    control,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<WaitlistInput>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { name: "", phone: "", email: "", consent: false, website: "" },
    mode: "onTouched",
  })

  function onSubmit(values: WaitlistInput) {
    setError(null)
    startTransition(async () => {
      const result = await joinWaitlist(values)
      if (!result.ok) {
        setError(result.error)
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) setFieldError(field as keyof WaitlistInput, { message })
        return
      }
      setDone(result.already ? "already" : "new")
    })
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center" role="status">
        <span aria-hidden className="flex size-24 items-center justify-center rounded-full bg-highlight text-highlight-foreground motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in motion-safe:zoom-in-50">
          <CheckIcon strokeWidth={1.75} className="size-10" />
        </span>
        <h2 className="text-[24px] leading-8 font-semibold tracking-[-0.02em]">
          {done === "already" ? "Você já está na lista! 😉" : "Pronto! Você está na lista."}
        </h2>
        <p className="text-base leading-6 text-muted-foreground">
          {done === "already" ? "Seu e-mail já estava cadastrado. Avisamos você assim que o Organizzou for lançado." : "Avisamos você em primeira mão quando o Organizzou for lançado."}
        </p>
        <Button type="button" size="xl" className={cn("w-full", MOTION)} onClick={onClose}>
          Fechar
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="relative flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wl-name" className="text-[14px] leading-5">
          Nome
        </Label>
        <Input id="wl-name" autoComplete="name" placeholder="Seu nome aqui" className={inputClass} aria-invalid={Boolean(errors.name)} {...register("name")} />
        {errors.name ? <FormMessage kind="error">{errors.name.message}</FormMessage> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wl-phone" className="text-[14px] leading-5">
          WhatsApp
        </Label>
        <div className="flex gap-2">
          <span className="flex h-[52px] shrink-0 items-center rounded-xl border border-input px-4 text-base dark:bg-input/30" aria-label="Código do Brasil">
            +55
          </span>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Input
                id="wl-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(11) 91234-5678"
                className={inputClass}
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wl-email" className="text-[14px] leading-5">
          E-mail
        </Label>
        <Input id="wl-email" type="email" inputMode="email" autoComplete="email" placeholder="Seu e-mail aqui" className={inputClass} aria-invalid={Boolean(errors.email)} {...register("email")} />
        {errors.email ? <FormMessage kind="error">{errors.email.message}</FormMessage> : null}
      </div>

      {/* Honeypot: off-screen, skipped by keyboard and screen readers. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="wl-website">Site</label>
        <input id="wl-website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="consent"
            render={({ field }) => (
              <Checkbox id="wl-consent" checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} aria-invalid={Boolean(errors.consent)} className="mt-0.5" />
            )}
          />
          <Label htmlFor="wl-consent" className="text-[14px] leading-5 font-normal text-muted-foreground">
            <span>
              Concordo em receber novidades do Organizzou e com a{" "}
              <a href="/politicas#privacidade" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">
                Política de privacidade
              </a>
              .
            </span>
          </Label>
        </div>
        {errors.consent ? <FormMessage kind="error">{errors.consent.message}</FormMessage> : null}
      </div>

      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      <Button type="submit" size="xl" className={cn("w-full", MOTION)} disabled={pending}>
        {pending ? "Enviando…" : "Quero ser avisado"}
      </Button>
    </form>
  )
}

/** The capsule button + the dialog (desktop) / bottom drawer (mobile). Closes on X, Esc and outside click; both lock page scroll. */
export function WaitlistDialog() {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const close = () => setOpen(false)

  return (
    <>
      <Button
        type="button"
        size="xl"
        onClick={() => setOpen(true)}
        className={cn(
          "h-[52px] w-full shrink-0 rounded-full bg-highlight px-7 text-[17px] font-medium text-highlight-foreground hover:scale-105 hover:bg-highlight lg:w-auto",
          MOTION
        )}
      >
        <ChevronRightIcon strokeWidth={2} className="size-5" /> Avise-me quando lançar
      </Button>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader className="text-center">
              <DrawerTitle className="text-[24px] leading-8 font-semibold tracking-[-0.02em]">{TITLE}</DrawerTitle>
              <DrawerDescription className="text-sm leading-5">{DESCRIPTION}</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{open ? <WaitlistForm onClose={close} /> : null}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto rounded-[28px] p-8 sm:max-w-[440px]">
            <DialogHeader className="text-center">
              <DialogTitle className="text-[24px] leading-8 font-semibold tracking-[-0.02em]">{TITLE}</DialogTitle>
              <DialogDescription className="text-base leading-6">{DESCRIPTION}</DialogDescription>
            </DialogHeader>
            {open ? <WaitlistForm onClose={close} /> : null}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
