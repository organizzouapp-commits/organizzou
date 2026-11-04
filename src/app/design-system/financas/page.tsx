import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

import { FixtureFinancas } from "./fixture-financas"

/** Development-only fixture of Finanças (every row in memory). 404 in production. */
async function Fixture() {
  await connection()
  return <FixtureFinancas nowIso={new Date().toISOString()} />
}

export default function FinancasFixturePage() {
  if (process.env.NODE_ENV === "production") notFound()
  return (
    <TooltipProvider>
      <main className="mx-auto w-full max-w-[1400px] px-4 pt-6 pb-6 md:px-6 md:pb-6">
        <Suspense>
          <Fixture />
        </Suspense>
      </main>
    </TooltipProvider>
  )
}
