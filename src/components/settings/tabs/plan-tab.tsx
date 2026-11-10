"use client"

import { PlanoScreen } from "@/components/plan/plano-screen"

/** The plans and the billing note: what used to be the separate "Plano Pro" page. */
export default function PlanTab({ email, name }: { email: string; name: string }) {
  return <PlanoScreen email={email} name={name} />
}
