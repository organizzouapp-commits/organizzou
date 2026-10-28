"use client"

import { createContext, useContext, useMemo } from "react"

import { canUseWhatsApp, isPro, PLANS, type PlanDefinition, type PlanId } from "@/lib/plans"

type PlanState = { plan: PlanId; whatsappConnected: boolean }

const PlanContext = createContext<PlanState>({ plan: "free", whatsappConnected: false })

/**
 * `whatsappConnected`: there is no WhatsApp integration yet (docs/INTEGRATIONS-STATUS.md), so this is always false in
 * production; development can flip it with the dev_whatsapp cookie to exercise the three states of the sidebar card.
 */
export function PlanProvider({ plan, whatsappConnected = false, children }: { plan: PlanId; whatsappConnected?: boolean; children: React.ReactNode }) {
  const value = useMemo(() => ({ plan, whatsappConnected }), [plan, whatsappConnected])
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

/** The signed-in user's plan (defaults to "free" outside the provider). Server code uses `getUserPlan` from `@/lib/plan-server`. */
export function usePlan(): { plan: PlanId; definition: PlanDefinition; pro: boolean; whatsappConnected: boolean; canUseWhatsApp: boolean } {
  const { plan, whatsappConnected } = useContext(PlanContext)
  return { plan, definition: PLANS[plan], pro: isPro(plan), whatsappConnected, canUseWhatsApp: canUseWhatsApp(plan) }
}
