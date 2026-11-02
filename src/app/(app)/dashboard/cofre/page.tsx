import type { Metadata } from "next"
import { LockKeyholeIcon } from "lucide-react"

import { EmptyState } from "@/components/organizzou/EmptyState"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { SoonBadge } from "@/components/organizzou/SoonBadge"

export const metadata: Metadata = { title: "Cofre" }

/**
 * The vault is only worth having with encryption in the browser (a master password nobody else knows), and that is not built yet.
 * Until then this honest page stands in: nothing is stored, nothing is faked, and no table exists that anything could read.
 */
export default function CofrePage() {
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
