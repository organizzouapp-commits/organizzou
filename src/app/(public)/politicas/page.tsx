import type { Metadata } from "next"
import Link from "next/link"

import { Logo } from "@/components/organizzou/Logo"
import { ThemeToggle } from "@/components/organizzou/ThemeToggle"
import { AppBackground } from "@/components/shell/app-background"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Políticas",
  description: "Termos de uso, política de privacidade e cookies do Organizzou.",
  alternates: { canonical: "/politicas" },
}

const SECTIONS = [
  { id: "termos", label: "Termos de uso" },
  { id: "privacidade", label: "Política de privacidade" },
  { id: "cookies", label: "Cookies" },
] as const

const link =
  "rounded-full px-4 py-2 text-[15px] leading-6 outline-none transition-[color,background-color,box-shadow] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"

/** Update this date whenever the texts change. */
const LAST_UPDATED = "28 de outubro de 2026"

// One public page for the three documents; each has an anchor (/politicas#termos, #privacidade, #cookies).
export default function PoliciesPage() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* Same photo treatment as the app and the site (pre-blurred WebP, no runtime blur). */}
      <AppBackground />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6 md:px-6">
        <Link href="/" aria-label="Organizzou, início" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo className="h-8" />
        </Link>
        <ThemeToggle round tooltip />
      </header>
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 md:px-6 lg:flex-row lg:gap-12">
      <aside className="sticky top-0 z-30 -mx-4 border-b border-border bg-background px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:-mx-6 md:px-6 lg:top-8 lg:z-auto lg:mx-0 lg:h-fit lg:w-60 lg:shrink-0 lg:border-b-0 lg:bg-transparent lg:p-0">
        <p className="mb-3 hidden text-[13px] leading-5 font-medium tracking-[0.08em] text-muted-foreground uppercase lg:block">Políticas</p>
        <nav aria-label="Índice das políticas" className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className={cn(link, "snap-start border border-border whitespace-nowrap lg:border-0")}>
              {section.label}
            </a>
          ))}
        </nav>
        <Link href="/" className="mt-4 hidden px-4 text-[15px] underline underline-offset-4 lg:inline-block">
          Voltar ao início
        </Link>
      </aside>

      <article className="flex min-w-0 max-w-3xl flex-1 flex-col gap-12 rounded-[28px] border border-border bg-card p-6 md:p-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em]">Políticas do Organizzou</h1>
          <p className="text-[13px] leading-5 text-muted-foreground">Última atualização: {LAST_UPDATED}</p>
        </div>

        <section id="termos" aria-labelledby="termos-title" className="flex scroll-mt-24 flex-col gap-4 lg:scroll-mt-8">
          <h2 id="termos-title" className="text-[22px] leading-8 font-semibold tracking-[-0.01em]">
            Termos de uso
          </h2>
          <p className="max-w-prose text-base leading-7 text-muted-foreground">Rascunho provisório. O texto jurídico definitivo será revisado antes do lançamento.</p>
          <p className="max-w-prose text-base leading-7">
            O Organizzou é um aplicativo de organização pessoal. Você é responsável pelas informações que registra e por manter sua senha em segurança.
          </p>
        </section>

        <section id="privacidade" aria-labelledby="privacidade-title" className="flex scroll-mt-24 flex-col gap-4 lg:scroll-mt-8">
          <h2 id="privacidade-title" className="text-[22px] leading-8 font-semibold tracking-[-0.01em]">
            Política de privacidade
          </h2>
          <p className="max-w-prose text-base leading-7 text-muted-foreground">
            Rascunho provisório. O texto definitivo, em conformidade com a LGPD, será revisado antes do lançamento.
          </p>
          <p className="max-w-prose text-base leading-7">
            Seus dados ficam isolados por conta. O cofre de senhas é criptografado no seu dispositivo e o assistente nunca tem acesso a ele.
          </p>
        </section>

        <section id="cookies" aria-labelledby="cookies-title" className="flex scroll-mt-24 flex-col gap-4 lg:scroll-mt-8">
          <h2 id="cookies-title" className="text-[22px] leading-8 font-semibold tracking-[-0.01em]">
            Cookies
          </h2>
          <p className="max-w-prose text-base leading-7">
            Usamos cookies para o Organizzou funcionar e, só com a sua permissão, para entender e melhorar o uso do app. Você escolhe na primeira visita e
            pode mudar quando quiser em Configurações, em &quot;Preferências de cookies&quot;.
          </p>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-base leading-6">
            <li>
              <strong>Essenciais:</strong> mantêm você conectado, protegem a sua conta e guardam preferências como o tema e o menu. Sem eles o app não
              funciona, por isso estão sempre ativos.
            </li>
            <li>
              <strong>Análise:</strong> medem, de forma agregada, quais telas são usadas e onde há erros, para melhorarmos o produto. Ficam desligados até
              você aceitar.
            </li>
            <li>
              <strong>Marketing:</strong> medem campanhas e personalizam comunicações fora do app. Ficam desligados até você aceitar.
            </li>
          </ul>
          <p className="max-w-prose text-base leading-7 text-muted-foreground">
            Guardamos a sua escolha em um cookie chamado <code>organizzou_consent</code>, por 12 meses. Se esta política mudar, pediremos a sua escolha de
            novo. Rascunho provisório, a ser revisado antes do lançamento.
          </p>
        </section>

        <Link href="/" className="text-[15px] underline underline-offset-4 lg:hidden">
          Voltar ao início
        </Link>
      </article>
    </main>
    </div>
  )
}
