import { Suspense } from "react"
import type { Metadata } from "next"
import { LockKeyholeIcon } from "lucide-react"

import { EmptyState } from "@/components/organizzou/EmptyState"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { WithNow } from "@/components/mock/with-now"
import { CofreScreen } from "@/components/vault/cofre-screen"
import { isMock } from "@/mocks/config"

export const metadata: Metadata = { title: "Cofre" }

export default function CofrePage() {
  // The vault is only worth having with encryption in the browser (a master password nobody else knows), and that is not built yet.
  // Until then a real account sees this honest page instead of example items: nothing is stored, nothing is faked.
  if (!isMock) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader />
        <EmptyState
          icon={LockKeyholeIcon}
          title="O Cofre ainda não está disponível"
          description="Ele guardará senhas e documentos criptografados no seu navegador, com uma senha mestra que só você sabe. Enquanto isso não existe, nada é guardado aqui."
          action={<SoonBadge />}
        />
      </div>
    )
  }
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <CofreScreen nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
