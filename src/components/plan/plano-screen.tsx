"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ClockIcon, ExternalLinkIcon, LockKeyholeIcon, ShieldCheckIcon, SparklesIcon, TriangleAlertIcon, WalletCardsIcon } from "lucide-react"
import { toast } from "sonner"

import { BentoStat } from "@/components/finance/bento"
import { HatchedProgress, HeroCard } from "@/components/finance/parts"
import { usePlan } from "@/components/organizzou/plan-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { InvoiceRow } from "@/features/billing/types"
import type { PlanPeriod } from "@/lib/billing/pricing"
import { formatBRL } from "@/lib/money"
import type { PlanUsage } from "@/lib/plan-usage"
import { usageView } from "@/lib/plan-usage"
import { cn } from "@/lib/utils"

import { CheckoutDialog } from "./checkout-dialog"
import { CancelDialog, ProActivatedDialog } from "./plan-dialogs"
import { PlanComparison } from "./plan-comparison"
import { annualPerMonthCents, type Banner, bannerFor, dateBR, METHOD_LABEL, priceLine, savingText } from "./plan-model"
import { useBilling } from "./use-billing"

const EMPTY_USAGE: PlanUsage = { boards: null, lists: null, assistantToday: null }
const card = "flex min-w-0 flex-col gap-4 rounded-[24px] border-2 bg-card p-5 md:p-6"
const INVOICE_LABEL: Record<string, string> = { RECEIVED: "Paga", CONFIRMED: "Paga", RECEIVED_IN_CASH: "Paga", PENDING: "Pendente", OVERDUE: "Atrasada", REFUNDED: "Reembolsada" }

function BannerView({ banner }: { banner: Banner }) {
  const Icon = banner.kind === "pending" ? ClockIcon : TriangleAlertIcon
  return (
    <div role={banner.kind === "failed" ? "alert" : "status"} data-testid={`plan-banner-${banner.kind}`} className="flex items-start gap-3 rounded-[20px] border-2 border-foreground p-4 text-[14px] leading-5">
      <Icon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
      <p className="min-w-0">
        <strong className="font-semibold">{banner.title}.</strong> {banner.text}
      </p>
    </div>
  )
}

function Invoices({ invoices }: { invoices: InvoiceRow[] }) {
  if (invoices.length === 0) return <p className="text-[15px] leading-6 text-muted-foreground">Quando houver uma cobrança, ela aparece aqui.</p>
  return (
    <ul className="flex flex-col" aria-label="Faturas">
      {invoices.map((invoice) => (
        <li key={invoice.id} className="flex min-h-14 items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
          <div className="flex min-w-0 flex-col">
            <span className="tabular text-[15px] leading-6">{invoice.dueDate ? dateBR(invoice.dueDate) : "—"}</span>
            <span className="truncate text-[13px] leading-5 text-muted-foreground">{invoice.description ?? "Organizzou Pro"}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="tabular text-[15px] leading-6 font-medium">{formatBRL(invoice.amountCents)}</span>
            <Badge variant="secondary">{INVOICE_LABEL[invoice.status] ?? invoice.status}</Badge>
            {invoice.invoiceUrl ? (
              <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir a fatura" className="grid size-11 place-items-center rounded-full outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                <ExternalLinkIcon aria-hidden strokeWidth={1.75} className="size-4" />
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * Plano e cobrança. Free: the launch offer, what you use of the free plan, the three plans, the comparison. Pro: the current plan and next
 * charge, the invoices, the payment method, the annual offer and the cancel card. The state comes from /api/billing/status; anything it cannot
 * say reads as the Free plan.
 */
export function PlanoScreen({ usage = EMPTY_USAGE }: { email?: string; name?: string; usage?: PlanUsage }) {
  const { pro } = usePlan()
  const router = useRouter()
  const params = useSearchParams()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [period, setPeriod] = useState<PlanPeriod>("monthly")
  const [success, setSuccess] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [changing, setChanging] = useState(false)
  const [now] = useState(() => new Date())
  const celebrated = useRef(false)

  const activated = useCallback(() => {
    if (celebrated.current) return
    celebrated.current = true
    setCheckoutOpen(false)
    setSuccess(true)
    router.refresh()
  }, [router])
  const billing = useBilling(activated)
  const { status } = billing

  // Coming back from the Asaas page (its success address carries ?pagamento=retorno): "pagamento pendente" shows right away, before the first answer of the server.
  const returned = params.get("pagamento") === "retorno"

  const sub = status?.subscription ?? null
  const isPro = pro || status?.plan === "pro"
  const banner: Banner | null = status ? bannerFor(status, now) : returned ? { kind: "pending", title: "Pagamento pendente", text: "Estamos esperando a confirmação. Assim que o pagamento cair, o Pro é liberado sozinho." } : null
  const firstTime = !status?.lastInvoice
  const open = (p: PlanPeriod) => {
    setPeriod(p)
    setCheckoutOpen(true)
  }

  async function switchToAnnual() {
    setChanging(true)
    try {
      const response = await fetch("/api/billing/change-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period: "annual" }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) return void toast.error(data.error ?? "Não consegui trocar de plano agora.")
      toast.success(data.effectiveOn ? `Plano anual a partir de ${dateBR(data.effectiveOn)}.` : "Plano anual ativado.")
      await billing.refresh()
    } catch {
      toast.error("Sem conexão. Confira a internet e tente de novo.")
    } finally {
      setChanging(false)
    }
  }

  const boards = usageView("free", "boards", usage.boards)
  const lists = usageView("free", "lists", usage.lists)
  const assistantToday = usage.assistantToday ?? 0

  return (
    <div className="@container flex flex-col gap-4">
      {banner ? <BannerView banner={banner} /> : null}
      {billing.unavailable && !isPro ? (
        <p role="status" className="rounded-[20px] border border-border p-4 text-[14px] leading-5 text-muted-foreground">
          O pagamento ainda não está disponível neste ambiente. Assim que for ligado, o botão de assinar funciona aqui.
        </p>
      ) : null}

      {isPro ? (
        <>
          <div className="grid grid-cols-2 gap-4 @min-[900px]:grid-cols-4">
            <HeroCard
              className="col-span-2"
              density="dense"
              label="Seu plano atual"
              value={sub ? (sub.period === "annual" ? "Pro Anual" : "Pro Mensal") : "Plano Pro"}
              support={sub?.cancelAtPeriodEnd ? `Termina em ${dateBR(status?.planUntil?.slice(0, 10))}` : sub?.nextChargeOn ? `Próxima cobrança: ${formatBRL(sub.nextChargeCents)} em ${dateBR(sub.nextChargeOn.slice(0, 10))}` : status?.planUntil ? `Pro até ${dateBR(status.planUntil.slice(0, 10))}` : "Pro ativo, sem cobrança"}
            />
            <BentoStat label="Assistente hoje" icon={SparklesIcon} chip="de 200 mensagens" footer={<HatchedProgress value={Math.min(100, Math.round((assistantToday / 200) * 100))} label={`Assistente hoje: ${assistantToday} de 200`} />} className="col-span-2 min-h-[168px]">
              {assistantToday} / 200
            </BentoStat>
          </div>

          <div className="grid grid-cols-1 gap-4 @min-[900px]:grid-cols-2">
            <section aria-label="Faturas" className={cn(card, "border-border")}>
              <h3 className="text-[17px] leading-6 font-semibold">Faturas</h3>
              <Invoices invoices={billing.invoices} />
            </section>
            <div className="flex flex-col gap-4">
              {sub ? (
                <section aria-label="Forma de pagamento" className={cn(card, "border-border")}>
                  <h3 className="flex items-center gap-2 text-[17px] leading-6 font-semibold">
                    <WalletCardsIcon aria-hidden strokeWidth={1.75} className="size-5" /> Forma de pagamento
                  </h3>
                  <p className="text-[15px] leading-6">{METHOD_LABEL[sub.method]}</p>
                  <p className="text-[13px] leading-5 text-muted-foreground">{sub.method === "card" ? "Renova sozinho todo período." : "Uma nova cobrança chega por e-mail a cada período, e o link fica nas faturas."}</p>
                </section>
              ) : null}
              {sub && sub.period === "monthly" && !sub.cancelAtPeriodEnd && sub.status === "active" ? (
                <section aria-label="Plano anual" className={cn(card, "border-primary")}>
                  <h3 className="text-[17px] leading-6 font-semibold">{savingText()}</h3>
                  <p className="text-[15px] leading-6 text-muted-foreground">No plano anual são {formatBRL(annualPerMonthCents())} por mês. A troca vale a partir da próxima cobrança.</p>
                  <Button type="button" size="lg" disabled={changing} className="h-12 self-start rounded-full" onClick={switchToAnnual}>
                    {changing ? "Trocando…" : "Mudar para o anual"}
                  </Button>
                </section>
              ) : null}
              {sub && sub.status !== "canceled" && sub.status !== "ended" && !sub.cancelAtPeriodEnd ? (
                <section aria-label="Cancelar" className={cn(card, "border-border")}>
                  <h3 className="text-[17px] leading-6 font-semibold">Cancelar assinatura</h3>
                  <p className="text-[15px] leading-6 text-muted-foreground">Seu Pro continua até o fim do período pago e nada é apagado.</p>
                  <Button type="button" size="lg" variant="outline" className="h-12 self-start rounded-full" onClick={() => setCancelOpen(true)}>
                    Cancelar assinatura
                  </Button>
                </section>
              ) : null}
              {sub?.cancelAtPeriodEnd ? (
                <section aria-label="Assinar de novo" className={cn(card, "border-border")}>
                  <h3 className="text-[17px] leading-6 font-semibold">Quer continuar?</h3>
                  <p className="text-[15px] leading-6 text-muted-foreground">Assine de novo a qualquer momento. Seus dados estão guardados.</p>
                  <Button type="button" size="lg" className="h-12 self-start rounded-full" onClick={() => open(sub.period)}>
                    Assinar de novo
                  </Button>
                </section>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <>
          <section aria-label="Oferta de lançamento" className="flex flex-col gap-4 rounded-[24px] bg-highlight p-5 text-highlight-foreground md:p-6">
            <Badge className="self-start bg-highlight-foreground/10 text-highlight-foreground">Oferta de lançamento</Badge>
            <h2 className="text-[28px] leading-8 font-semibold tracking-[-0.02em]">Pro por R$ 4,90 no 1º mês</h2>
            <p className="text-[15px] leading-6">Depois R$ 24,90 por mês, ou R$ 250,00 por ano. Cancele quando quiser.</p>
            <Button type="button" size="lg" disabled={billing.unavailable} className="h-12 self-start rounded-full bg-highlight-foreground text-highlight hover:bg-highlight-foreground/90" onClick={() => open("monthly")}>
              Experimentar por R$ 4,90
            </Button>
          </section>

          <section aria-label="Seu uso" className="grid grid-cols-2 gap-4">
            <BentoStat label="Quadros" icon={LockKeyholeIcon} chip="no Plano Gratuito" footer={boards.percent !== null ? <HatchedProgress value={boards.percent} label={`Quadros: ${boards.value}`} /> : undefined} className="min-h-[168px]">
              {usage.boards === null ? String(boards.limit ?? "") : `${usage.boards} de ${boards.limit}`}
            </BentoStat>
            <BentoStat label="Listas" icon={LockKeyholeIcon} chip="no Plano Gratuito" footer={lists.percent !== null ? <HatchedProgress value={lists.percent} label={`Listas: ${lists.value}`} /> : undefined} className="min-h-[168px]">
              {usage.lists === null ? String(lists.limit ?? "") : `${usage.lists} de ${lists.limit}`}
            </BentoStat>
          </section>

          <div className="grid grid-cols-1 gap-4 @min-[900px]:grid-cols-3">
            <section aria-label="Plano Gratuito" data-plan-card="free" data-current="true" className={cn(card, "border-primary")}>
              <header className="flex items-center justify-between gap-3">
                <h3 className="text-[17px] leading-6 font-semibold">Gratuito</h3>
                <Badge variant="secondary">Seu plano</Badge>
              </header>
              <p className="tabular text-[34px] leading-10 font-semibold tracking-[-0.02em]">R$ 0</p>
              <p className="text-[15px] leading-6 text-muted-foreground">Tarefas, finanças manuais e lembretes no celular.</p>
            </section>
            <section aria-label="Pro Mensal" data-plan-card="pro-monthly" data-current="false" className={cn(card, "border-border")}>
              <h3 className="text-[17px] leading-6 font-semibold">Pro Mensal</h3>
              <p className="tabular text-[34px] leading-10 font-semibold tracking-[-0.02em]">R$ 4,90</p>
              <p className="text-[15px] leading-6 text-muted-foreground">{priceLine("monthly")}</p>
              <Button type="button" size="lg" disabled={billing.unavailable} className="mt-auto h-12 rounded-full" onClick={() => open("monthly")}>
                Escolher o mensal
              </Button>
            </section>
            <section aria-label="Pro Anual" data-plan-card="pro-annual" data-current="false" className={cn(card, "border-primary")}>
              <header className="flex items-center justify-between gap-3">
                <h3 className="text-[17px] leading-6 font-semibold">Pro Anual</h3>
                <Badge className="bg-highlight text-highlight-foreground">Melhor valor</Badge>
              </header>
              <p className="flex items-baseline gap-1">
                <span className="tabular text-[34px] leading-10 font-semibold tracking-[-0.02em]">R$ 250,00</span>
                <span className="text-[15px] text-muted-foreground">/ano</span>
              </p>
              <p className="text-[15px] leading-6 text-muted-foreground">
                {formatBRL(annualPerMonthCents())} por mês. {savingText()}.
              </p>
              <Button type="button" size="lg" disabled={billing.unavailable} className="mt-auto h-12 rounded-full" onClick={() => open("annual")}>
                Escolher o anual
              </Button>
            </section>
          </div>

          <ul aria-label="Garantias" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] leading-5 text-muted-foreground">
            {["Pagamento seguro pelo Asaas", "Cartão, Pix ou boleto", "Cancele quando quiser", "Seus dados nunca são apagados"].map((text) => (
              <li key={text} className="flex items-center gap-2">
                <ShieldCheckIcon aria-hidden strokeWidth={1.75} className="size-4" /> {text}
              </li>
            ))}
          </ul>
        </>
      )}

      <section aria-label="Comparativo de planos" className={cn(card, "border-border")}>
        <h3 className="text-[17px] leading-6 font-semibold">Compare os planos</h3>
        <PlanComparison />
      </section>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} initialPeriod={period} firstTime={firstTime} onActivated={activated} />
      <ProActivatedDialog open={success} onOpenChange={setSuccess} />
      <CancelDialog open={cancelOpen} onOpenChange={setCancelOpen} endsOn={status?.planUntil ?? null} onCanceled={() => void billing.refresh()} />
    </div>
  )
}
