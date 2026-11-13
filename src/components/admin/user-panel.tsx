"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BadgeDollarSignIcon, LogOutIcon, MailCheckIcon, PauseCircleIcon, PlayCircleIcon, Trash2Icon } from "lucide-react"

import { ConfirmAction } from "@/components/admin/confirm-action"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { changePlan, deleteUser, resendConfirmation, setSuspended, signOutEverywhere } from "@/features/admin/actions"
import type { AuditRow, PlanHistoryRow, UserDetail } from "@/lib/admin/data"
import { fmtDate, fmtDateTime, fmtInt } from "@/lib/admin/format"
import { actionLabel, PLAN_LABELS, providerLabel } from "@/lib/admin/labels"
import { SECRET_KEY_HINT } from "@/lib/admin/secret-hint"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-[15px] last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="tabular min-w-0 text-right break-words">{value}</dd>
    </div>
  )
}

function statusOf(detail: UserDetail) {
  if (detail.banned_until && new Date(detail.banned_until).getTime() > Date.now()) return "suspended" as const
  if (!detail.email_confirmed_at) return "pending" as const
  return "active" as const
}

const STATUS_TEXT = { active: "Ativo", suspended: "Suspenso", pending: "Aguardando confirmação" } as const

function tomorrow() {
  const d = new Date(Date.now() + 86_400_000)
  return d.toISOString().slice(0, 10)
}

function PlanAction({ detail, disabled }: { detail: UserDetail; disabled: boolean }) {
  const [plan, setPlan] = useState<"free" | "pro">(detail.plan === "pro" ? "free" : "pro")
  const [until, setUntil] = useState("")
  return (
    <ConfirmAction
      disabled={disabled}
      trigger={
        <>
          <BadgeDollarSignIcon strokeWidth={1.75} /> Alterar plano
        </>
      }
      title="Alterar o plano"
      description={`Plano atual de ${detail.email}: ${PLAN_LABELS[detail.plan]}${detail.plan_until ? ` (até ${fmtDate(detail.plan_until)})` : ""}. A mudança vale na hora e fica registrada na auditoria.`}
      confirmLabel="Alterar plano"
      run={() => changePlan({ userId: detail.id, plan, until: plan === "pro" && until ? until : null })}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
          Novo plano
          <Select value={plan} onValueChange={(value) => setPlan(value as "free" | "pro")}>
            <SelectTrigger aria-label="Novo plano" className="h-11 w-full rounded-full px-4 text-[15px] text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Gratuito</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
            </SelectContent>
          </Select>
        </label>
        {plan === "pro" ? (
          <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
            Pro de cortesia até (opcional)
            <Input type="date" min={tomorrow()} value={until} onChange={(event) => setUntil(event.target.value)} className="h-11 rounded-full px-4 text-[15px] text-foreground" />
            <span>Sem data, o Pro não tem fim. Com data, a pessoa volta ao Gratuito sozinha no dia seguinte.</span>
          </label>
        ) : null}
      </div>
    </ConfirmAction>
  )
}

type UserPanelProps = {
  detail: UserDetail | null
  plans: PlanHistoryRow[]
  audit: AuditRow[]
  /** SUPABASE_SECRET_KEY is set on the server. Without it every write action is disabled. */
  canWrite: boolean
  adminId: string
  /** A test account: listed with a "Teste" badge and left out of the aggregate numbers. */
  isTest?: boolean
}

/** Right-hand panel from 1024 px, full-screen sheet below. Open while `?usuario=` is in the URL. */
export function UserPanel({ detail, plans, audit, canWrite, adminId, isTest = false }: UserPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function close() {
    const next = new URLSearchParams(searchParams.toString())
    next.delete("usuario")
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const status = detail ? statusOf(detail) : null
  const self = detail?.id === adminId

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full! gap-0 sm:max-w-none! lg:w-[520px]!" aria-describedby="user-panel-description">
        {detail && status ? (
          <>
            <SheetHeader className="border-b border-border p-6 pr-14">
              <SheetTitle className="truncate text-[20px] leading-7">{detail.name || detail.email.split("@")[0]}</SheetTitle>
              <SheetDescription id="user-panel-description" className="truncate">
                {detail.email}
              </SheetDescription>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant={detail.plan === "pro" ? "default" : "secondary"} className="rounded-full">
                  {PLAN_LABELS[detail.plan]}
                  {detail.plan_until ? ` até ${fmtDate(detail.plan_until)}` : ""}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {STATUS_TEXT[status]}
                </Badge>
                {isTest ? (
                  <Badge variant="outline" className="rounded-full border-highlight/60 bg-highlight/15">
                    Teste
                  </Badge>
                ) : null}
              </div>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <Section title="Conta">
                <dl>
                  <Fact label="Cadastro" value={fmtDateTime(detail.created_at)} />
                  <Fact label="E-mail confirmado" value={detail.email_confirmed_at ? fmtDateTime(detail.email_confirmed_at) : "Não"} />
                  <Fact label="Último acesso" value={fmtDateTime(detail.last_seen)} />
                  <Fact label="Último login" value={fmtDateTime(detail.last_sign_in_at)} />
                  <Fact label="Entra com" value={providerLabel(detail.providers.join(", "))} />
                  <Fact label="Telefone informado" value={detail.has_phone ? "Sim" : "Não"} />
                  <Fact label="Sessões abertas" value={fmtInt(detail.sessions)} />
                  <Fact label="Fuso e idioma" value={`${detail.timezone ?? "—"} · ${detail.locale ?? "—"}`} />
                </dl>
              </Section>

              <Section title="Registros por módulo (só contagem)">
                <dl>
                  <Fact label="Quadros de tarefas" value={fmtInt(detail.counts.boards)} />
                  <Fact label="Tarefas" value={fmtInt(detail.counts.tasks)} />
                  <Fact label="Etiquetas" value={fmtInt(detail.counts.tags)} />
                  <Fact label="Anexos" value={fmtInt(detail.counts.attachments)} />
                </dl>
                <p className="text-[13px] leading-5 text-muted-foreground">Os demais módulos ainda são simulados no app e não têm registros. O conteúdo nunca aparece aqui.</p>
              </Section>

              <Section title="Histórico de plano">
                {plans.length === 0 ? (
                  <p className="text-[15px] text-muted-foreground">Nenhuma mudança de plano registrada.</p>
                ) : (
                  <ul className="flex flex-col">
                    {plans.map((row) => (
                      <li key={row.id} className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-[15px] last:border-b-0">
                        <span>
                          {PLAN_LABELS[row.plan]}
                          {row.kind === "courtesy" ? " (cortesia" + (row.until ? ` até ${fmtDate(row.until)}` : "") + ")" : ""}
                        </span>
                        <span className="tabular text-[13px] text-muted-foreground">{fmtDateTime(row.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Ações do admin">
                <div className="flex flex-col gap-2">
                  <PlanAction key={detail.id + detail.plan} detail={detail} disabled={!canWrite} />
                  {status === "suspended" ? (
                    <ConfirmAction
                      disabled={!canWrite}
                      trigger={
                        <>
                          <PlayCircleIcon strokeWidth={1.75} /> Reativar conta
                        </>
                      }
                      title="Reativar esta conta?"
                      description={`${detail.email} volta a conseguir entrar no app.`}
                      confirmLabel="Reativar"
                      run={() => setSuspended({ userId: detail.id, suspended: false })}
                    />
                  ) : (
                    <ConfirmAction
                      disabled={!canWrite || self}
                      trigger={
                        <>
                          <PauseCircleIcon strokeWidth={1.75} /> Suspender conta
                        </>
                      }
                      title="Suspender esta conta?"
                      description={`${detail.email} deixa de conseguir entrar e de renovar a sessão. Você pode reativar depois. A pessoa não perde nenhum dado.`}
                      confirmLabel="Suspender"
                      run={() => setSuspended({ userId: detail.id, suspended: true })}
                    />
                  )}
                  {status === "pending" ? (
                    <ConfirmAction
                      disabled={!canWrite}
                      trigger={
                        <>
                          <MailCheckIcon strokeWidth={1.75} /> Reenviar confirmação
                        </>
                      }
                      title="Reenviar o e-mail de confirmação?"
                      description={`Enviamos de novo o link de confirmação para ${detail.email}.`}
                      confirmLabel="Reenviar"
                      run={() => resendConfirmation({ userId: detail.id })}
                    />
                  ) : null}
                  <ConfirmAction
                    disabled={!canWrite}
                    trigger={
                      <>
                        <LogOutIcon strokeWidth={1.75} /> Encerrar sessões
                      </>
                    }
                    title="Encerrar todas as sessões?"
                    description={`${detail.email} será desconectado de todos os aparelhos e precisará entrar de novo.`}
                    confirmLabel="Encerrar sessões"
                    run={() => signOutEverywhere({ userId: detail.id })}
                  />
                  <DeleteUserAction key={detail.id} detail={detail} disabled={!canWrite || self} />
                </div>
                {canWrite ? null : <p className="text-[13px] leading-5 text-muted-foreground">{SECRET_KEY_HINT}. Veja docs/ADMIN.md.</p>}
                {self ? <p className="text-[13px] leading-5 text-muted-foreground">Esta é a sua conta: você não pode suspendê-la nem excluí-la.</p> : null}
              </Section>

              <Section title="Auditoria desta pessoa">
                {audit.length === 0 ? (
                  <p className="text-[15px] text-muted-foreground">Nenhuma ação de admin registrada.</p>
                ) : (
                  <ul className="flex flex-col">
                    {audit.map((row) => (
                      <li key={row.id} className="flex flex-col gap-0.5 border-b border-border py-2 last:border-b-0">
                        <span className="text-[15px]">{actionLabel(row.action)}</span>
                        <span className="tabular text-[13px] text-muted-foreground">
                          {fmtDateTime(row.created_at)} · {row.admin_email ?? "admin removido"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="p-6 pr-14">
              <SheetTitle>Usuário não encontrado</SheetTitle>
              <SheetDescription id="user-panel-description">Esta conta não existe mais ou o link está errado.</SheetDescription>
            </SheetHeader>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Deleting the account: the admin has to type the account's e-mail first. The server checks it again. */
function DeleteUserAction({ detail, disabled }: { detail: UserDetail; disabled: boolean }) {
  const [typed, setTyped] = useState("")
  return (
    <ConfirmAction
      disabled={disabled}
      trigger={
        <>
          <Trash2Icon strokeWidth={1.75} /> Excluir conta
        </>
      }
      title="Excluir esta conta para sempre?"
      description={`${detail.email} e todos os dados dessa pessoa serão apagados. Não dá para desfazer. A ação fica registrada na auditoria.`}
      confirmLabel="Excluir conta"
      canConfirm={typed.trim().toLowerCase() === detail.email.toLowerCase()}
      run={async () => {
        const result = await deleteUser({ userId: detail.id, confirmEmail: typed })
        if (result.ok) setTyped("")
        return result
      }}
    >
      <div className="flex flex-col gap-2 px-1">
        <label htmlFor="delete-user-email" className="text-[13px] leading-5 text-muted-foreground">
          Digite <strong className="font-semibold text-foreground">{detail.email}</strong> para confirmar
        </label>
        <Input id="delete-user-email" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} className="h-11 rounded-xl" />
      </div>
    </ConfirmAction>
  )
}
