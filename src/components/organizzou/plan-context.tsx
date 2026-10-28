"use client"

import { createContext, useContext } from "react"

import { isPro, PLANS, type PlanDefinition, type PlanId } from "@/lib/plans"

const PlanContext = createContext<PlanId>("free")

export function PlanProvider({ plan, children }: { plan: PlanId; children: React.ReactNode }) {
  return <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>
}

/** The signed-in user's plan (defaults to "free" outside the provider). Server code uses `getUserPlan` from `@/lib/plan-server`. */
export function usePlan(): { plan: PlanId; definition: PlanDefinition; pro: boolean } {
  const plan = useContext(PlanContext)
  return { plan, definition: PLANS[plan], pro: isPro(plan) }
}
