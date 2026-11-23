"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { retryOrphanCleanup } from "@/features/admin/billing-actions"

/** Tries to delete one orphan subscription at Asaas again. The server action checks the admin role itself. */
export function OrphanRetryButton({ subscription }: { subscription: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      className="rounded-full"
      onClick={() =>
        start(async () => {
          const result = await retryOrphanCleanup({ subscription })
          if (result.ok) toast.success(result.message)
          else toast.error(result.error)
        })
      }
    >
      {pending ? "Apagando…" : "Tentar apagar de novo"}
    </Button>
  )
}
