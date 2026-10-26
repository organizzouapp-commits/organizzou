import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Privacidade — Organizzou" }

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 md:px-6">
      <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em]">
        Política de privacidade
      </h1>
      <p className="text-base leading-6 text-muted-foreground">
        Rascunho provisório. O texto definitivo, em conformidade com a LGPD, será revisado antes do
        lançamento.
      </p>
      <p className="text-base leading-6">
        Seus dados ficam isolados por conta. O cofre de senhas é criptografado no seu dispositivo e o
        assistente nunca tem acesso a ele.
      </p>
      <Link href="/entrar" className="text-[15px] underline underline-offset-4">
        Voltar
      </Link>
    </main>
  )
}
