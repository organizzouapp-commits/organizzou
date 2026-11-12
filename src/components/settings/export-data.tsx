"use client"

import { useState } from "react"
import { DownloadIcon, LoaderCircleIcon } from "lucide-react"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"

type Format = "json" | "csv"
type State = { kind: "idle" } | { kind: "loading"; format: Format } | { kind: "done"; format: Format } | { kind: "error"; message: string }

/** Downloads the person's data: one JSON file, or a zip with one CSV per table. The file name comes from the server. */
export function ExportData() {
  const [state, setState] = useState<State>({ kind: "idle" })
  const busy = state.kind === "loading"

  async function download(format: Format) {
    if (busy) return
    setState({ kind: "loading", format })
    try {
      const response = await fetch(`/api/export?format=${format}`, { cache: "no-store" })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        return setState({ kind: "error", message: body?.error ?? "Não consegui exportar agora. Tente de novo em instantes." })
      }
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? `organizzou-export.${format === "json" ? "json" : "zip"}`
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement("a")
      link.href = url
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setState({ kind: "done", format })
    } catch {
      setState({ kind: "error", message: "Não consegui exportar agora. Verifique a conexão e tente de novo." })
    }
  }

  const button = (format: Format, label: string) => (
    <Button type="button" variant="outline" disabled={busy} data-testid={`export-${format}`} onClick={() => void download(format)} className="h-11 rounded-full md:h-11">
      {state.kind === "loading" && state.format === format ? <LoaderCircleIcon strokeWidth={1.75} className="animate-spin motion-reduce:animate-none" /> : <DownloadIcon strokeWidth={1.75} />} {label}
    </Button>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {button("json", "Exportar tudo (JSON)")}
        {button("csv", "Planilhas (CSV)")}
      </div>
      <div aria-live="polite">
        {state.kind === "done" ? (
          <FormMessage kind="success">
            Pronto: o arquivo foi baixado.
          </FormMessage>
        ) : null}
        {state.kind === "error" ? <FormMessage kind="error">{state.message}</FormMessage> : null}
      </div>
      <p className="text-[13px] leading-5 text-muted-foreground">
        Tarefas, agenda, finanças, rotina, treinos, dieta, estudos, notas, metas, diário e o seu perfil. O JSON é um arquivo só; as planilhas vêm num .zip com um CSV por tabela (separado por ponto e vírgula, valores em reais). O Cofre é criptografado neste aparelho e não entra aqui: para levá-lo, use a exportação criptografada dentro do próprio Cofre. Até 3 exportações por hora.
      </p>
    </div>
  )
}
