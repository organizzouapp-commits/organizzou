import type { Metadata } from "next"
import Link from "next/link"

import { SignUpForm } from "@/components/auth/sign-up-form"

export const metadata: Metadata = { title: "Criar conta — Organizzou" }

export default function SignUpPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em]">Criar conta</h1>
        <p className="text-base leading-6 text-muted-foreground">
          Sua vida organizada em um só lugar.
        </p>
      </div>
      <SignUpForm />
      <p className="text-[13px] leading-5 text-muted-foreground">
        Ao criar a conta, você concorda com os{" "}
        <Link href="/termos" className="underline underline-offset-4">
          Termos de uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="underline underline-offset-4">
          Política de privacidade
        </Link>
        .
      </p>
      <p className="text-[15px] leading-6 text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-foreground underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </>
  )
}
