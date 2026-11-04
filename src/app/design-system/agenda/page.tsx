import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

import { FixtureAgenda } from "./fixture-agenda"

/** Development-only fixture of the Agenda page (events, tasks, treinos and estudos in memory). 404 in production. */
async function Fixture() {
  await connection()
  return <FixtureAgenda nowIso={new Date().toISOString()} />
}

export default function AgendaFixturePage() {
  if (process.env.NODE_ENV === "production") notFound()
  return (
    <TooltipProvider>
      <main className="mx-auto w-full max-w-[1400px] px-4 pt-6 pb-24 md:px-6 md:pb-6">
        <Suspense>
          <Fixture />
        </Suspense>
      </main>
    </TooltipProvider>
  )
}
