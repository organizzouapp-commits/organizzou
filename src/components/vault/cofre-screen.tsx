"use client"

import { useEffect, useState } from "react"
import { LockIcon, LockKeyholeIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { GeneratorTab } from "@/components/vault/generator-tab"
import { ItemsTab } from "@/components/vault/items-tab"
import { SecurityTab } from "@/components/vault/security-tab"
import { SetupCard, UnlockCard } from "@/components/vault/unlock-cards"
import { VaultContext } from "@/components/vault/vault-kit"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import { WrongPasswordError } from "@/features/vault/crypto"
import { countdownText } from "@/features/vault/health"
import { lockVault, unlockSession, useLockCountdown, useVaultSession, watchAuthSession } from "@/features/vault/session"
import { createIndexedDbRepo, storageAvailable, type VaultRepo } from "@/features/vault/storage"
import { createVault, loadItems, unlock } from "@/features/vault/vault"

type TabId = "itens" | "gerador" | "seguranca"
const TAB_ITEMS = [
  { id: "itens", label: "Itens" },
  { id: "gerador", label: "Gerador" },
  { id: "seguranca", label: "Segurança" },
]

/**
 * The Cofre. Everything here happens in the browser: the master password and the key never leave it, the items are encrypted before they
 * are stored (IndexedDB, this browser only), and nothing about the vault is sent to the server, the assistant or any analytics.
 * `userId` is only the account id (not a secret), used to keep two accounts of the same browser apart.
 */
export function CofreScreen({ userId }: { userId: string }) {
  const session = useVaultSession()
  const remaining = useLockCountdown()
  const [now] = useState(() => new Date())
  const isMobile = useIsMobile()
  const [repo, setRepo] = useState<VaultRepo | null>(null)
  const [unsupported, setUnsupported] = useState(false)
  const [initialized, setInitialized] = useState<boolean | null>(null)
  const [tab, setTab] = useState<TabId>("itens")
  const [adding, setAdding] = useState(false)
  // An item picked in the security report: the Itens tab opens with it selected.
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const selectTab = (next: TabId) => (setOpenItemId(null), setTab(next))
  const ready = session.status === "unlocked" && session.scope === userId

  // Open this account's vault in this browser (after mount: IndexedDB does not exist on the server).
  useEffect(() => {
    if (!storageAvailable()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnsupported(true)
      return
    }
    const next = createIndexedDbRepo(userId)
    setRepo(next)
    let cancelled = false
    next
      .loadMeta()
      .then((meta) => !cancelled && setInitialized(meta !== null))
      .catch(() => !cancelled && setUnsupported(true))
    return () => {
      cancelled = true
    }
  }, [userId])

  // A vault opened for another account is never left open here; the account's session ending locks it too.
  useEffect(() => {
    if (session.status === "unlocked" && session.scope !== userId) lockVault()
  }, [session.status, session.scope, userId])
  useEffect(() => {
    let off = () => {}
    let stopped = false
    void watchAuthSession().then((unsubscribe) => (stopped ? unsubscribe() : (off = unsubscribe)))
    return () => {
      stopped = true
      off()
    }
  }, [])

  usePrimaryAction("Adicionar item", () => {
    if (!ready) return void toast("Desbloqueie o Cofre primeiro.")
    setTab("itens")
    setAdding(true)
  })

  async function handleUnlock(password: string): Promise<boolean> {
    if (!repo) return false
    try {
      const key = await unlock(repo, password)
      const { items, corrupt } = await loadItems(repo, key)
      unlockSession(userId, key, items)
      if (corrupt.length > 0) toast(`${corrupt.length} ${corrupt.length === 1 ? "item não pôde" : "itens não puderam"} ser aberto${corrupt.length === 1 ? "" : "s"} (dados danificados).`)
      return true
    } catch (error) {
      if (error instanceof WrongPasswordError) return false
      return false
    }
  }

  async function handleCreate(password: string) {
    if (!repo) return
    try {
      const key = await createVault(repo, password)
      unlockSession(userId, key, [])
      setInitialized(true)
      toast.success("Cofre criado. Guarde a senha mestra em um lugar seguro.")
    } catch {
      toast("Não consegui criar o Cofre neste navegador.")
    }
  }

  // ---------------------------------------------------------- states without the vault open
  if (unsupported) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader />
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-[20px] border border-border p-8 text-center" data-testid="vault-unsupported">
          <span aria-hidden className="flex size-12 items-center justify-center rounded-full border border-border">
            <LockKeyholeIcon strokeWidth={1.75} className="size-5" />
          </span>
          <p className="text-[16px] leading-6 font-semibold">Este navegador não deixa guardar o Cofre</p>
          <p className="text-[13px] leading-5 text-muted-foreground">O Cofre guarda os dados criptografados no próprio aparelho. Em janelas privadas de alguns navegadores isso é bloqueado. Abra o Organizzou em uma janela normal.</p>
        </div>
      </div>
    )
  }

  if (!ready || !repo) {
    return (
      <div className={`flex min-w-0 flex-col gap-4${isMobile ? " pb-24" : ""}`} data-testid="cofre" data-state={initialized === null || !repo ? "loading" : initialized ? "locked" : "setup"}>
        <PageHeader />
        {initialized === null || !repo ? (
          <div className="flex justify-center py-6 md:py-12" data-testid="vault-loading">
            <Skeleton className="h-80 w-full max-w-md rounded-[20px]" />
          </div>
        ) : initialized ? (
          <UnlockCard onUnlock={handleUnlock} />
        ) : (
          <SetupCard onCreate={handleCreate} />
        )}
      </div>
    )
  }

  // ---------------------------------------------------------- the open vault
  const tabs = <PillTabs className={isMobile ? "w-full" : "w-fit max-w-full"} ariaLabel="Cofre" items={TAB_ITEMS} value={tab} onSelect={(item) => selectTab(item.id as TabId)} />
  const countdown = <LockChip seconds={remaining} autoLock={session.autoLock} />

  return (
    <VaultContext.Provider value={{ repo, scope: userId }}>
      <div className={`flex min-w-0 flex-col gap-4${isMobile ? " pb-24" : ""}`} data-testid="cofre" data-state="unlocked">
        <PageHeader />

        {isMobile ? (
          <>
            <section aria-label="Cofre" data-testid="cofre-header-block" className="mt-3 flex flex-col gap-2 rounded-[20px] border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[18px] leading-6 font-semibold">Cofre</h2>
                  <p className="truncate text-[13px] leading-5 text-muted-foreground">Criptografado no seu aparelho. Só você abre.</p>
                </div>
                <Button type="button" variant="outline" size="icon" aria-label="Bloquear agora" data-testid="lock-icon" onClick={() => lockVault()} className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-1">
                  <LockIcon strokeWidth={1.75} />
                </Button>
              </div>
              {tabs}
            </section>
            <div className="flex justify-center">{countdown}</div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {tabs}
            <div className="flex flex-wrap items-center gap-2">
              {countdown}
              <Button type="button" variant="outline" data-testid="lock-header" onClick={() => lockVault()} className="h-9 rounded-full px-4">
                <LockIcon strokeWidth={1.75} /> Bloquear agora
              </Button>
              <Button
                type="button"
                data-testid="add-header"
                onClick={() => {
                  setTab("itens")
                  setAdding(true)
                }}
                className="h-9 rounded-full bg-highlight px-4 text-highlight-foreground hover:bg-highlight/90"
              >
                <PlusIcon strokeWidth={1.75} /> Adicionar item
              </Button>
            </div>
          </div>
        )}

        {tab === "itens" ? <ItemsTab items={session.items} adding={adding} onAddingChange={setAdding} onOpenReport={() => selectTab("seguranca")} now={now} initialOpenId={openItemId} /> : null}
        {tab === "gerador" ? <GeneratorTab /> : null}
        {tab === "seguranca" ? <SecurityTab items={session.items} autoLock={session.autoLock} onOpenItem={(id) => (setOpenItemId(id), setTab("itens"))} /> : null}
      </div>
    </VaultContext.Provider>
  )
}

/** "Bloqueia em 4:32": the live countdown of the auto-lock timer (or, when it locks on leaving the tab, a plain note). */
function LockChip({ seconds, autoLock }: { seconds: number | null; autoLock: string }) {
  return (
    <span data-testid="lock-countdown" aria-live="off" className="tabular inline-flex h-8 items-center gap-1.5 rounded-full border border-foreground/25 px-3 text-[13px] leading-5 whitespace-nowrap text-muted-foreground">
      <LockIcon aria-hidden strokeWidth={1.75} className="size-3.5" />
      {autoLock === "hidden" ? "Bloqueia ao sair da aba" : seconds === null ? "Bloqueio automático" : `Bloqueia em ${countdownText(seconds)}`}
    </span>
  )
}
