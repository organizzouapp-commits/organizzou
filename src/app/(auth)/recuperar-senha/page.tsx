import type { Metadata } from "next"
import Link from "next/link"

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = { title: "Recuperar senha — Organizzou" }

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em]">Recuperar senha</h1>
        <p className="text-base leading-6 text-muted-foreground">
          Informe seu e-mail e enviaremos um link para criar uma nova senha.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-[15px] leading-6 text-muted-foreground">
        <Link href="/entrar" className="font-medium text-foreground underline underline-offset-4">
          Voltar para entrar
        </Link>
      </p>
    </>
  )
}
