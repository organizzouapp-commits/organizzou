"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/** "Verificar agora": re-renders the server page, which runs every check again. */
export function RecheckButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button type="button" variant="outline" className="h-11 rounded-full px-5" disabled={pending} onClick={() => start(() => router.refresh())}>
      <RefreshCwIcon strokeWidth={1.75} className={pending ? "animate-spin motion-reduce:animate-none" : undefined} /> {pending ? "Verificando…" : "Verificar agora"}
    </Button>
  )
}
