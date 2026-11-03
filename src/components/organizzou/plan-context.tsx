"use client"

import { createContext, useContext, useMemo } from "react"

import { isPro, PLANS, type PlanDefinition, type PlanId } from "@/lib/plans"

type PlanState = { plan: PlanId }

const PlanContext = createContext<PlanState>({ plan: "free" })

export function PlanProvider({ plan, children }: { plan: PlanId; children: React.ReactNode }) {
  const value = useMemo(() => ({ plan }), [plan])
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

/** The signed-in user's plan (defaults to "free" outside the provider). Server code uses `getUserPlan` from `@/lib/plan-server`. */
export function usePlan(): { plan: PlanId; definition: PlanDefinition; pro: boolean } {
  const { plan } = useContext(PlanContext)
  return { plan, definition: PLANS[plan], pro: isPro(plan) }
}
