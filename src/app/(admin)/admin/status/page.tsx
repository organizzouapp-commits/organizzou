import { CircleCheckIcon, CircleHelpIcon, CircleXIcon, HourglassIcon, InfoIcon, type LucideIcon } from "lucide-react"

import { Intro } from "@/components/admin/parts"
import { RecheckButton } from "@/components/admin/recheck-button"
import { BentoCard } from "@/components/organizzou/Bento"
import { PageShell } from "@/components/organizzou/layout"
import { fmtDateTime } from "@/lib/admin/format"
import { runChecks, type CheckState } from "@/lib/admin/status"

/** Icon + text for every state: the status never depends on color. */
const STATES: Record<CheckState, { icon: LucideIcon; text: string }> = {
  ok: { icon: CircleCheckIcon, text: "Operacional" },
  slow: { icon: HourglassIcon, text: "Lento" },
  down: { icon: CircleXIcon, text: "Fora do ar" },
  unknown: { icon: CircleHelpIcon, text: "Não verificado" },
  info: { icon: InfoIcon, text: "" },
}

export default async function StatusPage() {
  const checks = await runChecks()
  const checkedAt = new Date().toISOString()
  const problems = checks.filter((c) => c.state === "down" || c.state === "slow").length

  return (
    <PageShell actions={<RecheckButton />}>
      <Intro>
        {problems === 0 ? "Tudo que dá para verificar daqui está respondendo." : `${problems} ${problems === 1 ? "verificação precisa" : "verificações precisam"} de atenção.`} Verificado em {fmtDateTime(checkedAt)} pelo servidor. “Lento” = mais de 1,2 s.
      </Intro>
      <BentoCard bodyClassName="-my-2">
        <ul className="flex flex-col">
          {checks.map((check) => {
            const state = STATES[check.state]
            return (
              <li key={check.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border py-4 last:border-b-0">
                <span className="flex min-w-0 flex-1 basis-56 flex-col leading-tight">
                  <span className="text-[15px] font-medium">{check.label}</span>
                  <span className="text-[13px] leading-5 text-muted-foreground">{check.detail}</span>
                </span>
                <span className="tabular flex shrink-0 items-center gap-2 text-[15px]">
                  <state.icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
                  {check.text ?? state.text}
                </span>
              </li>
            )
          })}
        </ul>
      </BentoCard>
    </PageShell>
  )
}
