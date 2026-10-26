import type { Metadata } from "next"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const metadata: Metadata = { title: "Nova senha — Organizzou" }

export default function ResetPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em]">Criar nova senha</h1>
        <p className="text-base leading-6 text-muted-foreground">
          Escolha uma senha que você não use em outros lugares.
        </p>
      </div>
      <ResetPasswordForm />
    </>
  )
}
