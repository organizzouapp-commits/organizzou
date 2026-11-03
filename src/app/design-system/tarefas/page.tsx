import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

import { FixtureBoard } from "./fixture-board"

/** Development-only fixture of the Tarefas board (the real screens on an in-memory API). 404 in production. */
const clockNow = () => Date.now()

async function Fixture({ searchParams }: { searchParams: Promise<{ view?: string; volume?: string }> }) {
  await connection()
  const { view, volume } = await searchParams
  return <FixtureBoard nowMs={clockNow()} volume={Math.min(Number(volume) || 0, 100)} view={view === "kanban" || view === "lista" || view === "calendario" ? view : null} />
}

export default function TarefasFixturePage({ searchParams }: { searchParams: Promise<{ view?: string; volume?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  return (
    <TooltipProvider>
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 max-md:pt-44 md:px-6">
        <Suspense>
          <Fixture searchParams={searchParams} />
        </Suspense>
      </main>
    </TooltipProvider>
  )
}
