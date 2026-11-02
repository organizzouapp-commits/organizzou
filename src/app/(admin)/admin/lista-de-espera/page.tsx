import { ListChecksIcon } from "lucide-react"

import { ExportButton } from "@/components/admin/export-button"
import { DataUnavailable, Pager, TableCard } from "@/components/admin/parts"
import { BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { PageShell, StatRow } from "@/components/organizzou/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { exportWaitlistCsv } from "@/features/admin/actions"
import { waitlistList, waitlistSummary, WAITLIST_PAGE_SIZE } from "@/lib/admin/data"
import { fmtDateTime, fmtInt } from "@/lib/admin/format"
import { sourceLabel } from "@/lib/admin/labels"
import { secretKeyConfigured } from "@/lib/admin/secret"

type SearchParams = Record<string, string | string[] | undefined>
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const SOURCES = ["em-breve", "plano-pro"] as const

function href(q: string | null, origem: string | null, page: number) {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (origem) params.set("origem", origem)
  if (page > 1) params.set("pagina", String(page))
  const query = params.toString()
  return query ? `?${query}` : "?"
}

export default async function WaitlistPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const q = one(sp.q)?.trim().slice(0, 100) || null
  const origem = SOURCES.find((s) => s === one(sp.origem)) ?? null
  const page = Math.max(1, Number.parseInt(one(sp.pagina) ?? "1", 10) || 1)

  const [list, summary] = await Promise.all([waitlistList(q, origem, page), waitlistSummary()])
  const rows = list.ok ? list.data : []
  const total = rows[0]?.total ?? 0
  const bySource = new Map(summary.ok ? summary.data.map((s) => [s.source, s.total]) : [])
  const all = [...bySource.values()].reduce((sum, n) => sum + n, 0)

  return (
    <PageShell
      actions={
        <ExportButton
          enabled={secretKeyConfigured()}
          run={async () => {
            "use server"
            return exportWaitlistCsv({ search: q, source: origem })
          }}
        />
      }
    >
      <StatRow min={200}>
        <KpiCard label="Na lista de espera" value={fmtInt(all)} support="pessoas" tone="highlight" />
        <KpiCard label="Vieram do site" value={fmtInt(bySource.get("em-breve") ?? 0)} support="formulário da página inicial" />
        <KpiCard label="Vieram do Plano Pro" value={fmtInt(bySource.get("plano-pro") ?? 0)} support="diálogo “Fazer upgrade”" />
      </StatRow>

      <form role="search" method="get" aria-label="Filtrar a lista de espera" className="flex flex-wrap items-center gap-3">
        <Input type="search" name="q" defaultValue={q ?? ""} aria-label="Buscar por nome ou e-mail" placeholder="Buscar por nome ou e-mail" className="h-11 min-w-60 flex-1 rounded-full bg-card px-5 text-[15px]" />
        <select name="origem" defaultValue={origem ?? ""} aria-label="Origem" className="h-11 rounded-full border border-input bg-card px-4 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <option value="">Origem: todas</option>
          <option value="em-breve">Site</option>
          <option value="plano-pro">Plano Pro (diálogo)</option>
        </select>
        <Button type="submit" className="h-11 rounded-full px-5">
          Filtrar
        </Button>
      </form>

      {!list.ok ? (
        <DataUnavailable error={list.error} />
      ) : rows.length === 0 ? (
        <BentoCard>
          <EmptyState icon={ListChecksIcon} title="Ninguém na lista" description={q || origem ? "Nenhum resultado para esse filtro." : "Quando alguém pedir para entrar, aparece aqui."} />
        </BentoCard>
      ) : (
        <>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="pr-6">Entrou em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-6 font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.email}</TableCell>
                    <TableCell className="tabular whitespace-nowrap">{row.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full whitespace-nowrap">
                        {sourceLabel(row.source)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular pr-6 whitespace-nowrap">{fmtDateTime(row.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
          <Pager page={page} pageSize={WAITLIST_PAGE_SIZE} total={total} hrefFor={(p) => href(q, origem, p)} />
        </>
      )}
    </PageShell>
  )
}
