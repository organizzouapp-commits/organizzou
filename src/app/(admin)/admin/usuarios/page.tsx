import Link from "next/link"
import { ArrowDownIcon, ArrowUpIcon, UsersIcon } from "lucide-react"

import { ExportButton } from "@/components/admin/export-button"
import { DataUnavailable, Pager, TableCard } from "@/components/admin/parts"
import { UserFilters } from "@/components/admin/user-filters"
import { UserPanel } from "@/components/admin/user-panel"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { PageShell } from "@/components/organizzou/layout"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { exportUsersCsv } from "@/features/admin/actions"
import { listUsers, testAccountIds, USER_PAGE_SIZE, userDetail, userHistory, type UserFilters as Filters } from "@/lib/admin/data"
import { requireAdmin } from "@/lib/admin/guard"
import { fmtDate, fmtDateTime } from "@/lib/admin/format"
import { PLAN_LABELS, providerLabel, STATUS_LABELS } from "@/lib/admin/labels"
import { secretKeyConfigured } from "@/lib/admin/secret"
import { parsePage, parseUserFilters, userQuery } from "@/lib/admin/user-query"
import { cn } from "@/lib/utils"

type SearchParams = Record<string, string | string[] | undefined>

function initials(value: string) {
  return value
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function SortHead({ filters, column, children, className }: { filters: Filters; column: Filters["sort"]; children: React.ReactNode; className?: string }) {
  const active = filters.sort === column
  const nextDir = active && filters.dir === "asc" ? "desc" : "asc"
  const Icon = filters.dir === "asc" ? ArrowUpIcon : ArrowDownIcon
  return (
    <TableHead className={className} aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        href={userQuery(filters, 1, { ordem: column, dir: nextDir, usuario: null })}
        scroll={false}
        className="-mx-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {children}
        {active ? <Icon aria-hidden strokeWidth={1.75} className="size-4" /> : null}
      </Link>
    </TableHead>
  )
}

/** Marks a test account in the list: it is listed, but left out of the aggregate numbers. */
function TestBadge() {
  return (
    <Badge variant="outline" className="shrink-0 rounded-full border-highlight/60 bg-highlight/15 whitespace-nowrap">
      Teste
    </Badge>
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const filters = parseUserFilters(sp)
  const page = parsePage(sp)
  const selected = typeof sp.usuario === "string" && UUID.test(sp.usuario) ? sp.usuario : null

  const { adminId } = await requireAdmin()
  const canWrite = secretKeyConfigured()
  const [list, tests, detail, history] = await Promise.all([
    listUsers(filters, page),
    testAccountIds(),
    selected ? userDetail(selected) : Promise.resolve(null),
    selected ? userHistory(selected) : Promise.resolve({ plans: [], audit: [] }),
  ])

  const rows = list.ok ? list.data : []
  const total = rows[0]?.total ?? 0

  return (
    <PageShell
      actions={
        <ExportButton
          enabled={canWrite}
          run={async () => {
            "use server"
            return exportUsersCsv(filters)
          }}
        />
      }
    >
      <UserFilters q={filters.search ?? ""} plano={filters.plan ?? ""} status={filters.status ?? ""} atividade={filters.activity ?? ""} de={filters.from ?? ""} ate={filters.to ?? ""} />

      {!list.ok ? (
        <DataUnavailable error={list.error} />
      ) : rows.length === 0 ? (
        <TableCard>
          <EmptyState icon={UsersIcon} title="Nenhum usuário encontrado" description="Ajuste a busca ou limpe os filtros." />
        </TableCard>
      ) : (
        <>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead filters={filters} column="name" className="min-w-56 pl-6">
                    Nome
                  </SortHead>
                  <SortHead filters={filters} column="email">
                    E-mail
                  </SortHead>
                  <SortHead filters={filters} column="plan">
                    Plano
                  </SortHead>
                  <SortHead filters={filters} column="created_at">
                    Cadastro
                  </SortHead>
                  <SortHead filters={filters} column="last_seen">
                    Último acesso
                  </SortHead>
                  <TableHead>Login</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-state={row.id === selected ? "selected" : undefined} className={cn("relative", row.id === selected && "bg-muted")}>
                    <TableCell className="pl-6">
                      <Link
                        href={userQuery(filters, page, { usuario: row.id })}
                        scroll={false}
                        aria-label={`Abrir ${row.name || row.email}`}
                        className="flex min-h-11 items-center gap-3 rounded-full outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <Avatar className="size-9 shrink-0">
                          <AvatarFallback>{initials(row.name || row.email)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium">{row.name || row.email.split("@")[0]}</span>
                        {tests.has(row.id) ? <TestBadge /> : null}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">{row.email}</TableCell>
                    <TableCell>
                      <Badge variant={row.plan === "pro" ? "default" : "secondary"} className="rounded-full">
                        {PLAN_LABELS[row.plan]}
                        {row.plan_until ? ` até ${fmtDate(row.plan_until)}` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap">{fmtDate(row.created_at)}</TableCell>
                    <TableCell className="tabular whitespace-nowrap">{fmtDateTime(row.last_seen)}</TableCell>
                    <TableCell>{providerLabel(row.provider)}</TableCell>
                    <TableCell className="pr-6">
                      <Badge variant="outline" className="rounded-full whitespace-nowrap">
                        {STATUS_LABELS[row.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
          <Pager page={page} pageSize={USER_PAGE_SIZE} total={total} hrefFor={(p) => userQuery(filters, p, { usuario: null })} />
        </>
      )}

      {selected ? (
        <UserPanel
          key={selected}
          detail={detail && detail.ok ? detail.data : null}
          plans={history.plans}
          audit={history.audit}
          canWrite={canWrite}
          adminId={adminId}
          isTest={selected ? tests.has(selected) : false}
        />
      ) : null}
    </PageShell>
  )
}
