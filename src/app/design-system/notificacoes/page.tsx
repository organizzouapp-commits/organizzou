import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { NotificationsProvider } from "@/components/shell/notifications"
import { Bell } from "@/components/shell/app-topbar"
import type { AppNotification } from "@/features/notifications/types"

/** Development-only fixture: the real bell with 30 notifications, to check the capped panel. 404 in production. */
const clockNow = () => Date.now()
const KINDS = ["info", "task", "agenda", "bill", "habit", "workout"] as const

async function Fixture({ params }: { params: Promise<{ n?: string }> }) {
  await connection()
  const count = Math.min(120, Math.max(0, Number((await params).n ?? 30)))
  const base = clockNow()
  const items: AppNotification[] = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    kind: KINDS[i % KINDS.length],
    title: `Notificação ${i + 1}: um aviso com um título que pode ocupar mais de uma linha`,
    body: i % 2 === 0 ? "Detalhe curto da notificação." : null,
    link: null,
    read_at: i > 20 ? new Date(base).toISOString() : null,
    created_at: new Date(base - i * 3_600_000).toISOString(),
  }))
  return (
    <NotificationsProvider initial={items}>
      <main className="flex min-h-dvh items-start justify-end p-4">
        <Bell />
      </main>
    </NotificationsProvider>
  )
}

export default function NotificationsFixturePage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  return (
    <Suspense>
      <Fixture params={searchParams} />
    </Suspense>
  )
}
