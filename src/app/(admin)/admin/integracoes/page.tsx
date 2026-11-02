import { CircleCheckIcon, CircleDashedIcon, FlaskConicalIcon } from "lucide-react"

import { DataUnavailable, Intro } from "@/components/admin/parts"
import { BentoCard } from "@/components/organizzou/Bento"
import { PageGrid, PageShell } from "@/components/organizzou/layout"
import { Badge } from "@/components/ui/badge"
import { integrationNumbers, type IntegrationNumbers } from "@/lib/admin/data"
import { fmtInt } from "@/lib/admin/format"
import { INTEGRATIONS, STATUS_TEXT, type IntegrationStatus } from "@/lib/admin/integrations"

const STATUS_ICON = { real: CircleCheckIcon, simulated: FlaskConicalIcon, "not-built": CircleDashedIcon } as const

function numbersFor(id: string, n: IntegrationNumbers): { label: string; value: number }[] {
  switch (id) {
    case "auth":
      return [
        { label: "Contas criadas", value: n.total_users },
        { label: "Entram com e-mail", value: n.email_users },
      ]
    case "google":
      return [{ label: "Entram com Google", value: n.google_users }]
    case "whatsapp":
      // Phone numbers typed at sign-up, NOT linked WhatsApp numbers: linking does not exist yet.
      return [
        { label: "Números vinculados", value: 0 },
        { label: "Telefones informados no cadastro", value: n.phones_informed },
      ]
    default:
      return []
  }
}

function StatusLabel({ status }: { status: IntegrationStatus }) {
  const Icon = STATUS_ICON[status]
  return (
    <Badge variant={status === "real" ? "default" : "outline"} className="gap-1.5 rounded-full">
      <Icon aria-hidden strokeWidth={1.75} className="size-3.5" />
      {STATUS_TEXT[status]}
    </Badge>
  )
}

export default async function IntegrationsPage() {
  const numbers = await integrationNumbers()
  return (
    <PageShell>
      <Intro>
        Reflete <span className="font-mono text-[14px] text-foreground">docs/INTEGRATIONS-STATUS.md</span>. Números só aparecem quando existem de verdade.
      </Intro>
      {numbers.ok ? null : <DataUnavailable error={numbers.error} title="Os números não carregaram" />}
      <PageGrid>
        {INTEGRATIONS.map((integration) => {
          const stats = numbers.ok ? numbersFor(integration.id, numbers.data) : []
          return (
            <PageGrid.Item key={integration.id} span="third">
              <BentoCard title={integration.name} className="h-full" actions={<StatusLabel status={integration.status} />}>
                <div className="flex h-full flex-col gap-4">
                  <integration.icon aria-hidden strokeWidth={1.75} className="size-6 text-muted-foreground" />
                  <p className="text-[15px] leading-6 text-muted-foreground">{integration.summary}</p>
                  {stats.length > 0 ? (
                    <dl className="flex flex-col">
                      {stats.map((stat) => (
                        <div key={stat.label} className="flex items-baseline justify-between gap-4 border-t border-border py-2 text-[15px]">
                          <dt className="text-muted-foreground">{stat.label}</dt>
                          <dd className="tabular font-medium">{fmtInt(stat.value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <p className="mt-auto font-mono text-[12px] leading-4 break-all text-muted-foreground">{integration.where}</p>
                </div>
              </BentoCard>
            </PageGrid.Item>
          )
        })}
      </PageGrid>
    </PageShell>
  )
}
