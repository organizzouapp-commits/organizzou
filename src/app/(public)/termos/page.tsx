import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Termos de uso — Organizzou" }

export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 md:px-6">
      <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em]">Termos de uso</h1>
      <p className="text-base leading-6 text-muted-foreground">
        Rascunho provisório. O texto jurídico definitivo será revisado antes do lançamento.
      </p>
      <p className="text-base leading-6">
        O Organizzou é um aplicativo de organização pessoal. Você é responsável pelas informações que
        registra e por manter sua senha em segurança.
      </p>
      <Link href="/entrar" className="text-[15px] underline underline-offset-4">
        Voltar
      </Link>
    </main>
  )
}
