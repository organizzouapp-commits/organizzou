"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { saveAssistantBudget } from "@/features/admin/assistant-budget-action"

const SOURCES = { setting: "salvo aqui", env: "vem da variável ASSISTANT_MONTHLY_BUDGET_USD", none: "" } as const

/** The monthly budget in US$ (it only informs: it blocks nobody). The server action checks the admin role again before saving. */
export function AssistantBudgetForm({ current, source, canSave }: { current: number | null; source: keyof typeof SOURCES; canSave: boolean }) {
  const [value, setValue] = useState(current == null ? "" : String(current).replace(".", ","))
  const [pending, start] = useTransition()

  function save(next: string | null) {
    start(async () => {
      const result = await saveAssistantBudget({ usd: next })
      if (result.ok) {
        toast.success(result.message)
        if (next === null) setValue("")
      } else toast.error(result.error)
    })
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        save(value.trim() === "" ? null : value)
      }}
    >
      <label htmlFor="assistant-budget" className="text-[13px] leading-5 font-medium">
        Orçamento mensal (US$) {current != null && SOURCES[source] ? <span className="font-normal text-muted-foreground">· {SOURCES[source]}</span> : null}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="assistant-budget"
          inputMode="decimal"
          value={value}
          disabled={!canSave || pending}
          placeholder="Ex.: 20"
          onChange={(event) => setValue(event.target.value)}
          className="h-11 w-40 rounded-full border border-border bg-card px-4 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        />
        <Button type="submit" disabled={!canSave || pending} className="h-11 rounded-full px-5">
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        {current != null && source === "setting" ? (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => save(null)} className="h-11 rounded-full px-4 text-muted-foreground">
            Remover
          </Button>
        ) : null}
      </div>
      {!canSave ? <p className="text-[12px] leading-4 text-muted-foreground">Para salvar por aqui falta aplicar a migração 20261117000001_admin_assistant_cost.sql. Enquanto isso use a variável ASSISTANT_MONTHLY_BUDGET_USD.</p> : <p className="text-[12px] leading-4 text-muted-foreground">O orçamento só avisa: ninguém é bloqueado automaticamente.</p>}
    </form>
  )
}
