"use client"


import { CookieIcon, FingerprintIcon, MonitorSmartphoneIcon, type LucideIcon } from "lucide-react"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { openCookiePreferences } from "@/components/organizzou/cookie-consent"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { Button } from "@/components/ui/button"
import { ExportData } from "@/components/settings/export-data"
import { useTwoFactor } from "@/components/settings/two-factor-row"

const chip = "tabular inline-flex h-6 shrink-0 items-center rounded-full border border-foreground/25 px-2.5 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"

/** An icon circle, a title with its description, and the control on the right (stacked under the text on narrow cards). */
function Row({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-3 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border">
        <Icon strokeWidth={1.75} className="size-[18px]" />
      </span>
      <div className="flex min-w-0 flex-1 basis-48 flex-col">
        <span className="text-[15px] leading-6 font-medium">{title}</span>
        <span className="text-[13px] leading-5 text-muted-foreground">{description}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

/** Segurança e dados: account security and your data on the left, privacy on the right (one column on phones, same order). */
export function SecuritySettings() {
  const twoFactor = useTwoFactor()
  return (
    <Bento className="@container gap-4">
      <div className="col-span-12 flex min-w-0 flex-col gap-4 @min-[900px]:col-span-7">
        <BentoCard title="Segurança da conta">
          <div className="flex flex-col">
<Row icon={twoFactor.icon} title="Verificação em duas etapas" description={twoFactor.description}>              {twoFactor.control}            </Row>
            <Row icon={FingerprintIcon} title="Passkey" description="Entrar com biometria ou chave de segurança.">
              <Button type="button" variant="outline" disabled className="h-11 rounded-full md:h-11">
                Adicionar
              </Button>
              <SoonBadge />
            </Row>
            <Row icon={MonitorSmartphoneIcon} title="Este navegador" description="Sessão atual">
              <span data-chip="active" className={chip}>
                Ativa
              </span>
            </Row>
          </div>
        </BentoCard>

        <BentoCard title="Seus dados">
<ExportData />
        </BentoCard>
      </div>

      <div className="col-span-12 flex min-w-0 flex-col gap-4 @min-[900px]:col-span-5">
        <BentoCard title="Privacidade">
          <Row icon={CookieIcon} title="Preferências de cookies" description="Escolha se podemos usar cookies de análise e de marketing.">
            <Button type="button" variant="outline" onClick={openCookiePreferences} className="h-11 rounded-full md:h-11">
              Personalizar
            </Button>
          </Row>
        </BentoCard>
      </div>
    </Bento>
  )
}
