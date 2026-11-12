"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { ChevronDownIcon, MailIcon, SearchIcon, SparklesIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-context"
import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { usePlan } from "@/components/organizzou/plan-context"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { FAQ, filterFaq } from "@/features/help/faq"
import { SUPPORT_EMAIL } from "@/lib/support"
import { cn } from "@/lib/utils"


/** The questions as an accordion: one open at a time, a button per row (52 px) with aria-expanded, the chevron turns when it opens. */
function Faq({ items }: { items: typeof FAQ }) {
  const base = useId()
  const [open, setOpen] = useState<string | null>(null)
  // A question that the search filtered out cannot stay "open".
  const current = items.some((i) => i.id === open) ? open : null
  return (
    <ul className="flex flex-col" data-testid="faq-list">
      {items.map((item) => {
        const isOpen = current === item.id
        const panel = `${base}-${item.id}`
        return (
          <li key={item.id} className="border-b border-border last:border-b-0">
            <h3>
              <button
                type="button"
                id={`${panel}-q`}
                aria-expanded={isOpen}
                aria-controls={panel}
                data-faq={item.id}
                onClick={() => setOpen(isOpen ? null : item.id)}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-lg py-3 text-left text-[15px] leading-6 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {item.q}
                <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-[400ms] motion-reduce:transition-none", isOpen && "rotate-180")} />
              </button>
            </h3>
            <div id={panel} role="region" aria-labelledby={`${panel}-q`} hidden={!isOpen} className="max-w-[72ch] pb-4 text-[15px] leading-6 text-muted-foreground">
              {item.a.map((part, index) =>
                typeof part === "string" ? (
                  <span key={index}>{part}</span>
                ) : (
                  <Link key={index} href={part.href} className="rounded-sm text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    {part.label}
                  </Link>
                )
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Ajuda: the FAQ with a live search, a way to reach us (the assistant, an e-mail) and a not-yet-available problem report.
 * Desktop: the FAQ takes 8 columns, the contact cards 4; phones: contact first, then the FAQ, then the report.
 */
export function HelpView() {
  const { openAssistant } = useAssistant()
  const { pro } = usePlan()
  const isMobile = useIsMobile()
  const [query, setQuery] = useState("")
  const results = filterFaq(FAQ, query)

  return (
    <div data-testid="help" className={cn("flex min-w-0 flex-col gap-4", isMobile && "pb-24")}>
      {isMobile ? (
        <section aria-label="Ajuda" data-testid="help-header" className="rounded-[20px] border border-border bg-card p-4">
          <h2 className="text-[18px] leading-6 font-semibold">Ajuda</h2>
          <p className="text-[13px] leading-5 text-muted-foreground">Dúvidas frequentes e contato.</p>
        </section>
      ) : null}

      <Bento className="@container gap-4">
        <BentoCard title="Fale com a gente" className="order-1 col-span-12 @min-[900px]:order-2 @min-[900px]:col-span-4 @min-[900px]:col-start-9 @min-[900px]:row-start-1" bodyClassName="flex flex-col gap-4">
          <p className="text-[15px] leading-6 text-muted-foreground">Não achou o que procurava? Pergunte ao assistente ou mande uma mensagem para o nosso suporte.</p>
          <Button type="button" data-testid="talk-assistant" onClick={openAssistant} className="h-11 w-full rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/90 md:h-11">
            <SparklesIcon strokeWidth={1.75} /> Falar com o assistente
          </Button>
          {pro ? null : <p className="text-[13px] leading-5 text-muted-foreground">O assistente virtual é do Plano Pro: aqui você conhece os planos.</p>}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="flex min-h-11 items-center gap-3 rounded-xl text-[15px] underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
            <MailIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
            {SUPPORT_EMAIL}
          </a>
        </BentoCard>

        <BentoCard title="Perguntas frequentes" className="order-2 col-span-12 @min-[900px]:order-1 @min-[900px]:col-span-8 @min-[900px]:row-span-2" bodyClassName="flex flex-col gap-4">
          <div className="relative">
            <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nas perguntas" aria-label="Buscar nas perguntas" autoComplete="off" className="h-11 rounded-full pl-10 md:h-11" />
          </div>
          {results.length === 0 ? (
            <div data-testid="faq-empty" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <SearchIcon aria-hidden strokeWidth={1.75} className="size-8 text-muted-foreground" />
              <h3 className="text-[17px] leading-6 font-semibold">Nenhuma pergunta encontrada</h3>
              <p className="max-w-xs text-[15px] leading-6 text-muted-foreground">Tente outras palavras ou pergunte ao assistente.</p>
              <Button type="button" variant="outline" onClick={openAssistant} className="h-11 rounded-full md:h-11">
                <SparklesIcon strokeWidth={1.75} /> Falar com o assistente
              </Button>
            </div>
          ) : (
            <Faq items={results} />
          )}
        </BentoCard>

        <BentoCard title="Reportar problema" actions={<SoonBadge />} className="order-3 col-span-12 @min-[900px]:col-span-4 @min-[900px]:col-start-9 @min-[900px]:row-start-2" bodyClassName="flex flex-col gap-4">
          <p className="text-[13px] leading-5 text-muted-foreground">O envio por aqui ainda não está disponível. Por enquanto, descreva o problema por e-mail.</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-text" className="text-muted-foreground">
              O que aconteceu?
            </Label>
            <Textarea id="report-text" disabled placeholder="Conte o que você fez e o que esperava ver" />
          </div>
          <Button type="button" disabled className="h-11 w-full rounded-full md:h-11">
            Enviar relato
          </Button>
        </BentoCard>
      </Bento>
    </div>
  )
}
