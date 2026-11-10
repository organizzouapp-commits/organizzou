"use client"

import { PlanoScreen } from "@/components/plan/plano-screen"
import type { PlanUsage } from "@/lib/plan-usage"

/** The plans, the limits and the billing note: what used to be the separate "Plano Pro" page. */
export default function PlanTab({ email, name, usage }: { email: string; name: string; usage: PlanUsage }) {
  return <PlanoScreen email={email} name={name} usage={usage} />
}
