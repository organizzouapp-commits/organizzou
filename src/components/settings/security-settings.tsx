"use client"

import { useState } from "react"
import { CookieIcon, DownloadIcon, FingerprintIcon, MonitorSmartphoneIcon, ShieldCheckIcon, Trash2Icon, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { openCookiePreferences } from "@/components/organizzou/cookie-consent"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DELETE_CONFIRMATION, isDeleteConfirmation } from "@/features/settings/delete-account"
import { fieldClass, StickyFooter } from "@/components/workouts/sheet-fields"

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

/**
 * The confirmation step of "Excluir minha conta": type EXCLUIR to enable the button. Deleting the account is not available, so the entry
 * point is disabled and this button calls nothing: it only says so.
 */
function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [typed, setTyped] = useState("")
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Excluir minha conta" description="Isso apagaria sua conta e todos os seus dados. Não dá para desfazer.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-confirm">
            Digite <strong className="font-semibold">{DELETE_CONFIRMATION}</strong> para confirmar
          </Label>
          <Input id="delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} className={fieldClass} />
        </div>
        <StickyFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!isDeleteConfirmation(typed)}
            onClick={() => {
              onOpenChange(false)
              setTyped("")
              toast("A exclusão de conta ainda não está disponível.")
            }}
          >
            <Trash2Icon strokeWidth={1.75} /> Excluir conta
          </Button>
        </StickyFooter>
      </div>
    </ResponsiveSheet>
  )
}

/** Segurança e dados: account security and your data on the left, privacy and account deletion on the right (one column on phones, same order). */
export function SecuritySettings() {
  const [deleting, setDeleting] = useState(false)
  return (
    <Bento className="@container gap-4">
      <div className="col-span-12 flex min-w-0 flex-col gap-4 @min-[900px]:col-span-7">
        <BentoCard title="Segurança da conta">
          <div className="flex flex-col">
            <Row icon={ShieldCheckIcon} title="Verificação em duas etapas" description="Em breve: pedir um código do app autenticador ao entrar.">
              <Switch size="lg" checked={false} disabled aria-label="Verificação em duas etapas (em breve)" />
              <SoonBadge />
            </Row>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled className="h-11 rounded-full md:h-11">
              <DownloadIcon strokeWidth={1.75} /> Exportar tudo (JSON)
            </Button>
            <Button type="button" variant="outline" disabled className="h-11 rounded-full md:h-11">
              <DownloadIcon strokeWidth={1.75} /> Planilhas (CSV)
            </Button>
            <SoonBadge />
          </div>
          <p className="text-[13px] leading-5 text-muted-foreground">A exportação ainda não está disponível. O Cofre é exportado criptografado, e só de dentro do próprio Cofre.</p>
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

        <BentoCard title="Excluir minha conta">
          <Row icon={Trash2Icon} title="Excluir minha conta" description="A exclusão da conta ainda não está disponível por aqui.">
            <Button type="button" variant="outline" disabled onClick={() => setDeleting(true)} className="h-11 rounded-full md:h-11">
              Excluir
            </Button>
            <SoonBadge />
          </Row>
        </BentoCard>
      </div>

      <DeleteAccountDialog open={deleting} onOpenChange={setDeleting} />
    </Bento>
  )
}
