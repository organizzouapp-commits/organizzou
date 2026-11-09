"use client"

import { useEffect, useState } from "react"
import { EllipsisIcon, LockIcon, LockKeyholeIcon, PlusIcon } from "lucide-react"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import { WrongPasswordError } from "@/features/vault/crypto"
import { lockVault, touch, unlockSession, useVaultSession, watchAuthSession } from "@/features/vault/session"
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
  const isMobile = useIsMobile()
  const [repo, setRepo] = useState<VaultRepo | null>(null)
  const [unsupported, setUnsupported] = useState(false)
  const [initialized, setInitialized] = useState<boolean | null>(null)
  const [tab, setTab] = useState<TabId>("itens")
  const [adding, setAdding] = useState(false)
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
  const tabs = <PillTabs className={isMobile ? "w-full" : "w-fit max-w-full"} ariaLabel="Cofre" items={TAB_ITEMS} value={tab} onSelect={(item) => setTab(item.id as TabId)} />

  return (
    <VaultContext.Provider value={{ repo, scope: userId }}>
      <div className={`flex min-w-0 flex-col gap-4${isMobile ? " pb-24" : ""}`} data-testid="cofre" data-state="unlocked" onPointerDownCapture={touch} onKeyDownCapture={touch}>
        <PageHeader />

        {isMobile ? (
          <section aria-label="Cofre" data-testid="cofre-header-block" className="mt-3 flex flex-col gap-2 rounded-[20px] border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[18px] leading-6 font-semibold">Cofre</h2>
                <p className="truncate text-[13px] leading-5 text-muted-foreground">Criptografado no seu aparelho.</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Opções do Cofre" data-testid="cofre-options" className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-1">
                    <EllipsisIcon strokeWidth={1.75} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setTab("itens")
                      setAdding(true)
                    }}
                  >
                    <PlusIcon strokeWidth={1.75} /> Adicionar item
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => lockVault()}>
                    <LockIcon strokeWidth={1.75} /> Bloquear agora
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {tabs}
          </section>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {tabs}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" data-testid="lock-header" onClick={() => lockVault()} className="h-9 rounded-full px-4">
                <LockIcon strokeWidth={1.75} /> Bloquear agora
              </Button>
              {tab === "itens" ? (
                <Button type="button" data-testid="add-header" onClick={() => setAdding(true)} className="h-9 rounded-full bg-highlight px-4 text-highlight-foreground hover:bg-highlight/90">
                  <PlusIcon strokeWidth={1.75} /> Adicionar item
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {tab === "itens" ? <ItemsTab items={session.items} adding={adding} onAddingChange={setAdding} /> : null}
        {tab === "gerador" ? <GeneratorTab /> : null}
        {tab === "seguranca" ? <SecurityTab items={session.items} autoLock={session.autoLock} /> : null}
      </div>
    </VaultContext.Provider>
  )
}
