import { LifeBuoyIcon } from "lucide-react"

import { ComingSoon } from "@/components/admin/parts"
import { PageShell } from "@/components/organizzou/layout"
import { tableExists } from "@/lib/admin/data"

/** The support table the “Reportar problema” form will write to. Until it exists there is nothing to list. */
const SUPPORT_TABLE = "support_reports"

export default async function SupportPage() {
  const exists = await tableExists(SUPPORT_TABLE)

  if (!exists) {
    return (
      <PageShell>
        <ComingSoon
          icon={LifeBuoyIcon}
          title="Problemas reportados"
          description="O formulário “Reportar problema” da Ajuda ainda não foi construído, então não há nenhuma tabela de relatos para listar."
          needs={`a tabela public.${SUPPORT_TABLE} (usuário, mensagem, status aberto/em andamento/resolvido, responsável, nota de resposta) e o formulário gravando nela. Detalhes em docs/ADMIN.md`}
        />
      </PageShell>
    )
  }

  // The table exists but its shape is owned by whoever builds the form; the inbox UI is added together with it so the columns match.
  return (
    <PageShell>
      <ComingSoon
        icon={LifeBuoyIcon}
        title="Problemas reportados"
        description={`A tabela public.${SUPPORT_TABLE} já existe, mas a caixa de entrada do admin ainda não foi ligada a ela.`}
        needs="listar, atribuir e responder relatos (status aberto, em andamento e resolvido)"
      />
    </PageShell>
  )
}
