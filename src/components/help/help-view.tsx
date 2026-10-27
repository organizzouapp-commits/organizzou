"use client"

import { MailIcon, MessageCircleIcon, SparklesIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-context"
import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"

// Placeholder content: the real FAQ and the support address are defined before launch.
const FAQ = [
  {
    q: "Como conecto meu WhatsApp?",
    a: "Abra Configurações, aba WhatsApp, e siga os passos para vincular o seu número. Depois disso você fala com o assistente e recebe lembretes por lá.",
  },
  {
    q: "O que o assistente consegue fazer?",
    a: "Criar tarefas e notas, registrar gastos, responder perguntas sobre o seu dia e lembrar você do que importa. Toque no botão do assistente para experimentar.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Seus dados ficam isolados por conta. O cofre de senhas é criptografado no seu dispositivo e o assistente nunca tem acesso a ele. Veja os detalhes na política de privacidade.",
  },
  {
    q: "Como altero minha senha ou meus dados?",
    a: "Em Perfil você edita nome e telefone e troca a senha quando quiser.",
  },
  {
    q: "Como excluo minha conta?",
    a: "Fale com a gente pelo contato ao lado e cuidamos disso com você.",
  },
] as const

export function HelpView() {
  const { openAssistant } = useAssistant()
  return (
    <Bento>
      <BentoCard title="Perguntas frequentes" className="col-span-12 @min-[900px]:col-span-8">
        <Accordion type="single" collapsible>
          {FAQ.map((item, index) => (
            <AccordionItem key={item.q} value={`faq-${index}`}>
              <AccordionTrigger className="text-[15px]">{item.q}</AccordionTrigger>
              <AccordionContent className="text-[15px] leading-6 text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </BentoCard>

      <BentoCard title="Fale com a gente" className="col-span-12 @min-[900px]:col-span-4">
        <div className="flex flex-col gap-4">
          <p className="text-[15px] leading-6 text-muted-foreground">Não achou o que procurava? Pergunte ao assistente ou mande uma mensagem.</p>
          <Button type="button" onClick={openAssistant} className="self-start">
            <SparklesIcon strokeWidth={1.75} /> Perguntar ao assistente
          </Button>
          <a
            href="mailto:suporte@organizzouapp.com"
            className="flex items-center gap-3 rounded-xl text-[15px] underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <MailIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
            suporte@organizzouapp.com
          </a>
          <p className="flex items-center gap-3 text-[13px] leading-5 text-muted-foreground">
            <MessageCircleIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
            Atendimento pelo WhatsApp em breve.
          </p>
        </div>
      </BentoCard>
    </Bento>
  )
}
