"use client"

import { useTransition } from "react"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { ExportResult } from "@/features/admin/actions"
import { SECRET_KEY_HINT } from "@/lib/admin/secret-hint"

/** Runs a CSV export action on the server and hands the file to the browser. Disabled (with the reason) when the server key is missing. */
export function ExportButton({ run, enabled, label = "Exportar CSV" }: { run: () => Promise<ExportResult>; enabled: boolean; label?: string }) {
  const [pending, start] = useTransition()

  function onClick() {
    start(async () => {
      const result = await run()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }))
      const link = document.createElement("a")
      link.href = url
      link.download = result.filename
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`${result.rows} ${result.rows === 1 ? "linha exportada" : "linhas exportadas"}.`)
    })
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" className="h-11 rounded-full px-5" disabled={!enabled || pending} onClick={onClick}>
        <DownloadIcon strokeWidth={1.75} /> {pending ? "Exportando…" : label}
      </Button>
      {enabled ? null : <span className="text-[12px] leading-4 text-muted-foreground">{SECRET_KEY_HINT}</span>}
    </div>
  )
}
