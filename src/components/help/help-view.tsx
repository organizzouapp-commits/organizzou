"use client"

import { useState } from "react"
import { MailIcon, MessageCircleIcon, SearchIcon, SparklesIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-context"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { BentoCard } from "@/components/organizzou/Bento"
import { SplitLayout } from "@/components/organizzou/layout"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// Placeholder content: the real FAQ and the support address are defined before launch.
const FAQ = [
  {
    q: "Como conecto meu WhatsApp?",
    a: "A conexão com o WhatsApp ainda está em desenvolvimento. Em Configurações, aba WhatsApp, você acompanha a novidade e será avisado quando abrir.",
  },
  {
    q: "O que o assistente consegue fazer?",
    a: "Hoje o assistente é uma prévia: mostra como vai registrar tarefas, gastos e notas e responder perguntas sobre o seu dia, mas as respostas são de exemplo e nada é salvo. Toque no botão do assistente para experimentar.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Seus dados ficam isolados por conta. O cofre de senhas é criptografado no seu dispositivo e o assistente nunca tem acesso a ele. Veja os detalhes na política de privacidade.",
  },
  {
    q: "Como altero minha senha ou meus dados?",
    a: "Em Configurações, aba Perfil, você edita nome e telefone e troca a senha quando quiser.",
  },
  {
    q: "Como mudo entre o tema claro e o escuro?",
    a: "Use o botão de sol e lua no topo da tela, ou escolha em Configurações, aba Aparência. O app lembra a sua escolha.",
  },
  {
    q: "Como funciona o plano gratuito e o Plano Pro?",
    a: "O Plano Gratuito tem limites de listas, bancos conectados e mensagens por dia com o assistente. O Plano Pro remove esses limites. O pagamento ainda não está disponível: você pode entrar na lista de espera na página Plano Pro.",
  },
  {
    q: "Como excluo minha conta?",
    a: "A exclusão pela própria tela ainda não está disponível. Fale com a gente pelo contato ao lado e cuidamos disso com você.",
  },
] as const

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function HelpView() {
  const { openAssistant } = useAssistant()
  const [query, setQuery] = useState("")
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  const results = FAQ.filter((item) => terms.every((t) => normalize(`${item.q} ${item.a}`).includes(t)))

  return (
    <SplitLayout
      aside={
        <>
          <BentoCard title="Fale com a gente" bodyClassName="flex flex-col gap-4">
            <p className="text-[15px] leading-6 text-muted-foreground">Não achou o que procurava? Pergunte ao assistente ou mande uma mensagem.</p>
            <Button type="button" onClick={openAssistant} className="self-start">
              <SparklesIcon strokeWidth={1.75} /> Falar com o assistente
            </Button>
            <a href="mailto:suporte@organizzouapp.com" className="flex items-center gap-3 rounded-xl text-[15px] underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
              <MailIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
              suporte@organizzouapp.com
            </a>
            <p className="flex items-center gap-3 text-[13px] leading-5 text-muted-foreground">
              <MessageCircleIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
              Atendimento pelo WhatsApp em breve.
            </p>
          </BentoCard>
          <BentoCard title="Reportar problema" actions={<SoonBadge />} bodyClassName="flex flex-col gap-4">
            <p className="text-[13px] leading-5 text-muted-foreground">O envio por aqui ainda não está disponível. Por enquanto, descreva o problema por e-mail.</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="report-text" className="text-muted-foreground">O que aconteceu?</Label>
              <Textarea id="report-text" disabled placeholder="Conte o que você fez e o que esperava ver" />
            </div>
            <Button type="button" disabled className="self-start">
              Enviar relato
            </Button>
          </BentoCard>
        </>
      }
    >
      <BentoCard title="Perguntas frequentes" bodyClassName="flex flex-col gap-4">
        <div className="relative">
          <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nas perguntas" aria-label="Buscar nas perguntas" className="pl-9" />
        </div>
        {results.length === 0 ? (
          <EmptyState icon={SearchIcon} title="Nenhuma pergunta encontrada" description="Tente outras palavras ou fale com a gente ao lado." />
        ) : (
          <Accordion type="single" collapsible>
            {results.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger className="text-[15px]">{item.q}</AccordionTrigger>
                <AccordionContent className="max-w-[72ch] text-[15px] leading-6 text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </BentoCard>
    </SplitLayout>
  )
}
