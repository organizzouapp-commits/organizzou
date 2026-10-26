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
      <section aria-labelledby="cookies" className="flex flex-col gap-3">
        <h2 id="cookies" className="text-[19px] leading-7 font-semibold tracking-[-0.01em]">
          Cookies
        </h2>
        <p className="text-base leading-6">
          Usamos cookies para o Organizzou funcionar e, só com a sua permissão, para entender e melhorar o uso do app. Você escolhe na primeira
          visita e pode mudar quando quiser em Configurações, em &quot;Preferências de cookies&quot;.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base leading-6">
          <li>
            <strong>Essenciais:</strong> mantêm você conectado, protegem a sua conta e guardam preferências como o tema e o menu. Sem eles o app
            não funciona, por isso estão sempre ativos.
          </li>
          <li>
            <strong>Análise:</strong> medem, de forma agregada, quais telas são usadas e onde há erros, para melhorarmos o produto. Ficam
            desligados até você aceitar.
          </li>
          <li>
            <strong>Marketing:</strong> medem campanhas e personalizam comunicações fora do app. Ficam desligados até você aceitar.
          </li>
        </ul>
        <p className="text-base leading-6 text-muted-foreground">
          Guardamos a sua escolha em um cookie chamado <code>organizzou_consent</code>, por 12 meses. Se esta política mudar, pediremos a sua
          escolha de novo. Rascunho provisório, a ser revisado antes do lançamento.
        </p>
      </section>
      <Link href="/entrar" className="text-[15px] underline underline-offset-4">
        Voltar
      </Link>
    </main>
  )
}
