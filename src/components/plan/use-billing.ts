"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { InvoiceRow } from "@/features/billing/types"
import type { BillingStatus } from "@/lib/billing/service"

export type BillingView = {
  status: BillingStatus | null
  invoices: InvoiceRow[]
  loading: boolean
  /** The payment service is not configured in this environment (no key): the screen says so and the buttons stay off. */
  unavailable: boolean
  refresh: () => Promise<BillingStatus | null>
}

const POLL_MS = 5000
const POLL_MAX_MS = 5 * 60_000

/**
 * The billing state for the plan screen. Anything that cannot be read is "no billing" (the Free plan), never an error screen.
 * While a payment is pending (a card or boleto in the Asaas page, or a Pix) it asks again every few seconds, up to five minutes.
 */
export function useBilling(onActivated?: () => void): BillingView {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const wasPending = useRef(false)
  const alive = useRef(true)
  const callback = useRef(onActivated)
  useEffect(() => {
    callback.current = onActivated
  }, [onActivated])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/billing/status", { cache: "no-store" })
      if (response.status === 503) {
        if (alive.current) setUnavailable(true)
        return null
      }
      if (!response.ok) return null
      const next = (await response.json()) as BillingStatus
      if (!alive.current) return next
      setStatus(next)
      if (wasPending.current && next.plan === "pro" && !next.pendingPayment) callback.current?.()
      wasPending.current = next.pendingPayment
      if (next.subscription) {
        const list = await fetch("/api/billing/invoices", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { invoices: [] }), () => ({ invoices: [] }))
        if (alive.current) setInvoices((list as { invoices: InvoiceRow[] }).invoices ?? [])
      }
      return next
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    alive.current = true
    // The first read of the server state: state is only set after the answer arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().finally(() => alive.current && setLoading(false))
    return () => {
      alive.current = false
    }
  }, [refresh])

  const pending = status?.pendingPayment === true
  useEffect(() => {
    if (!pending) return
    const started = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - started > POLL_MAX_MS) return clearInterval(timer)
      void refresh()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [pending, refresh])

  return { status, invoices, loading, unavailable, refresh }
}
