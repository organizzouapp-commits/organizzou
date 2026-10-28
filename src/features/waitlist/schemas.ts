import { z } from "zod"

import { toE164 } from "@/features/auth/schemas"

export const waitlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome.")
    .max(80, "Use no máximo 80 caracteres."),
  phone: z
    .string()
    .trim()
    .min(1, "Informe seu WhatsApp.")
    .refine((value) => toE164(value) !== null, "Informe um WhatsApp válido com DDD."),
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .pipe(z.email("Esse e-mail não parece válido.")),
  consent: z.boolean().refine((value) => value === true, "Aceite para entrar na lista."),
  // Honeypot: real people never see or fill it.
  website: z.string().optional(),
  // Which list the person joins; defaults to the launch list.
  source: z.enum(["em-breve", "plano-pro"]).optional(),
})

export type WaitlistInput = z.input<typeof waitlistSchema>

export type WaitlistResult =
  | { ok: true; already?: boolean }
  | { ok: false; error: string; fieldErrors?: Partial<Record<"name" | "phone" | "email" | "consent", string>> }
