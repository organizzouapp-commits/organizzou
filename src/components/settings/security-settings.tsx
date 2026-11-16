"use client"

import { CookieIcon, FingerprintIcon } from "lucide-react"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { openCookiePreferences } from "@/components/organizzou/cookie-consent"
import { usePasskeys } from "@/components/settings/passkey-row"
import { SessionsList } from "@/components/settings/sessions-list"
import { SettingRow } from "@/components/settings/setting-row"
import { useTwoFactor } from "@/components/settings/two-factor-row"
import { Button } from "@/components/ui/button"

/** One row of a card (see SettingRow): the controls sit at the right end, under the text on a phone. */
const Row = SettingRow

/**
 * Segurança e dados: sign-in security (two-step code, passkeys), the active sessions on the left; privacy on the right
 * (one column on phones, same order). Deleting the account is not here: it lives only in the admin area.
 */
export function SecuritySettings() {
  const twoFactor = useTwoFactor()
  const passkeys = usePasskeys()
  return (
    <Bento className="@container gap-4">
      <div className="col-span-12 flex min-w-0 flex-col gap-4 @min-[900px]:col-span-7">
        <BentoCard title="Segurança da conta">
          <div className="flex flex-col">
            <Row icon={twoFactor.icon} title="Verificação em duas etapas" description={twoFactor.description}>
              {twoFactor.control}
            </Row>
            <Row icon={FingerprintIcon} title="Passkey" description={passkeys.description} fullWidthControlsOnMobile>
              {passkeys.control}
            </Row>
            {passkeys.list}
          </div>
        </BentoCard>

        <BentoCard title="Sessões ativas">
          <SessionsList />
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
