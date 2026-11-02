import Link from "next/link"
import { ScrollTextIcon } from "lucide-react"

import { DataUnavailable, Pager, TableCard } from "@/components/admin/parts"
import { BentoCard } from "@/components/organizzou/Bento"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { PageShell } from "@/components/organizzou/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AUDIT_PAGE_SIZE, auditFacets, listAudit, type AuditFilters } from "@/lib/admin/data"
import { fmtDateTime } from "@/lib/admin/format"
import { actionLabel } from "@/lib/admin/labels"

type SearchParams = Record<string, string | string[] | undefined>
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const day = (value: string | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null)

function href(filters: AuditFilters, page: number) {
  const params = new URLSearchParams()
  if (filters.admin) params.set("admin", filters.admin)
  if (filters.action) params.set("acao", filters.action)
  if (filters.from) params.set("de", filters.from)
  if (filters.to) params.set("ate", filters.to)
  if (page > 1) params.set("pagina", String(page))
  const query = params.toString()
  return query ? `?${query}` : "?"
}

const selectClass = "h-11 rounded-full border border-input bg-card px-4 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

/** Everything an admin did to someone's account. Admin-only through RLS; filters by admin, action and date. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const filters: AuditFilters = { admin: one(sp.admin)?.slice(0, 254) || null, action: one(sp.acao)?.slice(0, 60) || null, from: day(one(sp.de)), to: day(one(sp.ate)) }
  const page = Math.max(1, Number.parseInt(one(sp.pagina) ?? "1", 10) || 1)

  const [result, facets] = await Promise.all([listAudit(filters, page), auditFacets()])
  const dirty = Boolean(filters.admin || filters.action || filters.from || filters.to)

  return (
    <PageShell>
      <form role="search" method="get" aria-label="Filtrar a auditoria" className="flex flex-wrap items-center gap-3">
        <select name="admin" defaultValue={filters.admin ?? ""} aria-label="Admin" className={selectClass}>
          <option value="">Admin: todos</option>
          {facets.admins.map((email) => (
            <option key={email} value={email}>
              {email}
            </option>
          ))}
        </select>
        <select name="acao" defaultValue={filters.action ?? ""} aria-label="Ação" className={selectClass}>
          <option value="">Ação: todas</option>
          {facets.actions.map((action) => (
            <option key={action} value={action}>
              {actionLabel(action)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          De
          <Input type="date" name="de" defaultValue={filters.from ?? ""} className="h-11 w-40 rounded-full bg-card px-4 text-[15px]" />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          até
          <Input type="date" name="ate" defaultValue={filters.to ?? ""} className="h-11 w-40 rounded-full bg-card px-4 text-[15px]" />
        </label>
        <Button type="submit" className="h-11 rounded-full px-5">
          Filtrar
        </Button>
        {dirty ? (
          <Button asChild variant="ghost" className="h-11 rounded-full px-4">
            <Link href="?">Limpar filtros</Link>
          </Button>
        ) : null}
      </form>

      {!result.ok ? (
        <DataUnavailable error={result.error} />
      ) : result.rows.length === 0 ? (
        <BentoCard>
          <EmptyState icon={ScrollTextIcon} title="Nenhuma ação registrada" description={dirty ? "Nenhum registro para esse filtro." : "Toda mudança feita por um admin aparece aqui."} />
        </BentoCard>
      ) : (
        <>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Quando</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Pessoa afetada</TableHead>
                  <TableHead className="pr-6">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular pl-6 whitespace-nowrap">{fmtDateTime(row.created_at)}</TableCell>
                    <TableCell>{row.admin_email ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{actionLabel(row.action)}</TableCell>
                    <TableCell>
                      {row.target_user_id ? (
                        <Link href={`/admin/usuarios?usuario=${row.target_user_id}`} className="rounded-md outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                          {row.target_email ?? row.target_user_id}
                        </Link>
                      ) : (
                        (row.target_email ?? "—")
                      )}
                    </TableCell>
                    <TableCell className="max-w-72 pr-6 font-mono text-[13px] break-words text-muted-foreground">{Object.keys(row.payload).length > 0 ? JSON.stringify(row.payload) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
          <Pager page={page} pageSize={AUDIT_PAGE_SIZE} total={result.total} hrefFor={(p) => href(filters, p)} />
        </>
      )}
    </PageShell>
  )
}
