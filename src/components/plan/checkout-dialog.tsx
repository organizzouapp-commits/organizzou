"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CheckIcon, CopyIcon, CreditCardIcon, FileTextIcon, LoaderCircleIcon, QrCodeIcon, ShieldCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { maskCpfCnpj } from "@/lib/billing/cpf"
import type { PayMethod, PlanPeriod } from "@/lib/billing/pricing"
import { formatBRL } from "@/lib/money"
import { PLANS } from "@/lib/plans"
import { dayOf } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

import { annualPerMonthCents, checkoutIssue, type CheckoutDraft, dateBR, INITIAL_DRAFT, METHOD_HINT, METHOD_LABEL, pixCountdown, priceLine, savingText, summaryOf } from "./plan-model"

type PixData = { paymentId: string; qrImage: string; payload: string; expiresAt: string; amountCents: number }

const METHOD_ICON: Record<PayMethod, typeof CreditCardIcon> = { card: CreditCardIcon, pix: QrCodeIcon, boleto: FileTextIcon }

/**
 * The checkout: a dialog on the desktop, a bottom sheet on the phone. Step 1 the plan (Mensal/Anual) and the CPF/CNPJ, then how to pay, with the
 * summary ("Cobrado hoje" / "Próxima cobrança"). Pix shows its QR code HERE, with the expiry and an automatic check; card and boleto go to the
 * Asaas page, so card data never touches our server. The CPF/CNPJ goes to our server only to open the charge and is not shown again.
 */
export function CheckoutDialog({ open, onOpenChange, initialPeriod = "monthly", firstTime, onActivated }: { open: boolean; onOpenChange: (open: boolean) => void; initialPeriod?: PlanPeriod; firstTime: boolean; onActivated: () => void }) {
  const isMobile = useIsMobile()
  const body = open ? <CheckoutBody initialPeriod={initialPeriod} firstTime={firstTime} onClose={() => onOpenChange(false)} onActivated={onActivated} /> : null

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-[20px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="p-0 pb-3">
            <SheetTitle className="text-[20px] leading-7 font-semibold">Assinar o Pro</SheetTitle>
            <SheetDescription>Escolha o plano e como quer pagar.</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto rounded-[20px] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[20px] leading-7 font-semibold">Assinar o Pro</DialogTitle>
          <DialogDescription>Escolha o plano e como quer pagar.</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}

const choice = "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 p-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"

function CheckoutBody({ initialPeriod, firstTime, onClose, onActivated }: { initialPeriod: PlanPeriod; firstTime: boolean; onClose: () => void; onActivated: () => void }) {
  const [draft, setDraft] = useState<CheckoutDraft>({ ...INITIAL_DRAFT, period: initialPeriod })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pix, setPix] = useState<PixData | null>(null)
  const [today] = useState(() => dayOf(new Date(), 0))
  const summary = useMemo(() => summaryOf(draft, today, firstTime), [draft, today, firstTime])
  const issue = checkoutIssue(draft)

  async function submit() {
    if (issue || busy || !draft.method) return setError(issue)
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period: draft.period, method: draft.method, cpfCnpj: draft.cpfCnpj }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) return setError(data.error ?? "Não consegui iniciar o pagamento. Tente de novo em instantes.")
      if (data.kind === "pix") return setPix({ paymentId: data.paymentId, qrImage: data.qrImage, payload: data.payload, expiresAt: data.expiresAt, amountCents: data.amountCents })
      // Card and boleto: the Asaas-hosted page. Back here, the plan tab shows "pagamento pendente" until the payment is confirmed.
      window.location.assign(data.url)
    } catch {
      setError("Sem conexão. Confira a internet e tente de novo.")
    } finally {
      setBusy(false)
    }
  }

  if (pix) return <PixPanel pix={pix} onActivated={onActivated} onClose={onClose} />

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] leading-5 font-semibold">1. Plano</legend>
        {(["monthly", "annual"] as const).map((period) => (
          <button key={period} type="button" aria-pressed={draft.period === period} onClick={() => setDraft({ ...draft, period })} className={cn(choice, draft.period === period ? "border-primary bg-accent" : "border-border")}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] leading-6 font-semibold">{period === "monthly" ? "Mensal" : "Anual"}</span>
              <span className="text-[13px] leading-5 text-muted-foreground">{period === "monthly" && !firstTime ? `${formatBRL(PLANS.pro.price.monthlyCents)}/mês` : priceLine(period)}</span>
              {period === "annual" ? (
                <span className="text-[13px] leading-5 text-muted-foreground">
                  {formatBRL(annualPerMonthCents())}/mês · {savingText()}
                </span>
              ) : null}
            </span>
            {period === "annual" ? <span className="shrink-0 rounded-full bg-highlight px-2.5 py-1 text-[11px] leading-4 font-semibold text-highlight-foreground">Melhor valor</span> : null}
            {draft.period === period ? <CheckIcon aria-hidden className="size-5 shrink-0" strokeWidth={2} /> : null}
          </button>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="checkout-cpf" className="text-[13px] leading-5 font-semibold">
          CPF ou CNPJ de quem paga
        </Label>
        <Input id="checkout-cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={draft.cpfCnpj} onChange={(e) => setDraft({ ...draft, cpfCnpj: maskCpfCnpj(e.target.value) })} className="h-11 rounded-[12px] text-[16px]" />
        <p className="text-[12px] leading-4 text-muted-foreground">O Asaas exige para emitir a cobrança. Fica guardado só no servidor, nunca aparece no app.</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] leading-5 font-semibold">2. Como pagar</legend>
        {(["card", "pix", "boleto"] as const).map((method) => {
          const Icon = METHOD_ICON[method]
          return (
            <button key={method} type="button" aria-pressed={draft.method === method} onClick={() => setDraft({ ...draft, method })} className={cn(choice, draft.method === method ? "border-primary bg-accent" : "border-border")}>
              <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] leading-6 font-semibold">{METHOD_LABEL[method]}</span>
                <span className="text-[13px] leading-5 text-muted-foreground">{METHOD_HINT[method]}</span>
              </span>
              {draft.method === method ? <CheckIcon aria-hidden className="size-5 shrink-0" strokeWidth={2} /> : null}
            </button>
          )
        })}
      </fieldset>

      <dl className="flex flex-col gap-1 rounded-2xl border border-border p-4 text-[15px] leading-6" aria-label="Resumo">
        <div className="flex items-baseline justify-between gap-3">
          <dt>Cobrado hoje</dt>
          <dd className="tabular font-semibold">{formatBRL(summary.todayCents)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
          <dt>Próxima cobrança</dt>
          <dd className="tabular">
            {formatBRL(summary.nextCents)} em {dateBR(summary.nextOn)}
          </dd>
        </div>
      </dl>

      {error ? (
        <p role="alert" className="text-[14px] leading-5 text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={busy} className="h-12 rounded-full">
        {busy ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : null}
        {busy ? "Aguarde…" : draft.method === "pix" ? "Gerar Pix" : draft.method === "boleto" ? "Gerar boleto" : "Continuar para o pagamento"}
      </Button>
      <p className="flex items-center justify-center gap-2 text-center text-[12px] leading-4 text-muted-foreground">
        <ShieldCheckIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
        Pagamento seguro pelo Asaas. Cancele quando quiser.
      </p>
    </form>
  )
}

/** The Pix: QR code, copy-and-paste code, the time left, and an automatic check every few seconds until it is paid. */
function PixPanel({ pix, onActivated, onClose }: { pix: PixData; onActivated: () => void; onClose: () => void }) {
  const [now, setNow] = useState(() => new Date())
  const done = useRef(false)
  const countdown = pixCountdown(pix.expiresAt, now)

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (countdown.expired) return
    const poll = setInterval(async () => {
      if (done.current) return
      try {
        const response = await fetch(`/api/billing/status?payment=${encodeURIComponent(pix.paymentId)}`, { cache: "no-store" })
        if (!response.ok) return
        const data = await response.json()
        if (data.paymentPaid === true || (data.plan === "pro" && !data.pendingPayment)) {
          done.current = true
          onActivated()
        }
      } catch {
        // offline for a moment: the next check tries again
      }
    }, 4000)
    return () => clearInterval(poll)
  }, [pix.paymentId, countdown.expired, onActivated])

  async function copy() {
    try {
      await navigator.clipboard.writeText(pix.payload)
      toast.success("Código Pix copiado.")
    } catch {
      toast.error("Não consegui copiar. Segure o código para selecionar.")
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center" data-testid="pix-panel">
      <div>
        <p className="text-[17px] leading-6 font-semibold">Pague {formatBRL(pix.amountCents)} com Pix</p>
        <p className="text-[13px] leading-5 text-muted-foreground">Abra o app do seu banco e escaneie o QR code, ou use o código abaixo.</p>
      </div>
      {countdown.expired ? (
        <p role="status" className="rounded-2xl border border-border p-4 text-[15px] leading-6">
          Este Pix expirou. Feche e gere um novo.
        </p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a base64 QR code from Asaas: nothing for the image optimizer to do
        <img src={`data:image/png;base64,${pix.qrImage}`} alt="QR code do Pix" width={220} height={220} className="size-[220px] rounded-2xl border border-border bg-white p-2" />
      )}
      <p role="timer" aria-live="off" className="tabular text-[14px] leading-5 text-muted-foreground">
        {countdown.expired ? "Expirou" : `Expira em ${countdown.label}`}
      </p>
      <textarea readOnly aria-label="Código Pix copia e cola" value={pix.payload} rows={3} className="w-full resize-none rounded-[12px] border border-input bg-transparent p-3 text-[13px] leading-5 break-all" onFocus={(e) => e.currentTarget.select()} />
      <Button type="button" size="lg" variant="outline" className="h-12 w-full rounded-full" onClick={copy} disabled={countdown.expired}>
        <CopyIcon aria-hidden /> Copiar código
      </Button>
      <p role="status" className="flex items-center gap-2 text-[13px] leading-5 text-muted-foreground">
        {countdown.expired ? null : <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />}
        {countdown.expired ? "" : "Esperando o pagamento. Esta tela atualiza sozinha."}
      </p>
      <Button type="button" variant="ghost" className="h-11 rounded-full" onClick={onClose}>
        Fechar
      </Button>
    </div>
  )
}
