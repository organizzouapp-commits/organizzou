"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Switch } from "@/components/ui/switch"
import { setIncludeTestAccounts } from "@/features/admin/preferences"

/** The admin numbers leave test accounts (the demo account) out; this switch, remembered per admin, counts them again. */
export function IncludeTestToggle({ initial }: { initial: boolean }) {
  const router = useRouter()
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()

  function change(next: boolean) {
    setOn(next)
    start(async () => {
      const result = await setIncludeTestAccounts({ include: next })
      if (!result.ok) {
        setOn(!next)
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <label className="mb-4 flex min-h-11 items-center justify-end gap-3 text-[13px] leading-5 text-muted-foreground">
      Incluir contas de teste
      <Switch checked={on} disabled={pending} onCheckedChange={change} aria-label="Incluir contas de teste" />
    </label>
  )
}
