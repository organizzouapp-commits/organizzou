"use client"

import { LIST_CARD } from "@/components/finance/parts"
import { ITEM_ICONS } from "@/components/vault/item-icons"
import { chip } from "@/components/vault/vault-kit"
import { VAULT_TYPE_LABELS, type VaultItem } from "@/features/vault/types"
import { cn } from "@/lib/utils"

/** What a list row says under the name: never a secret. */
export function itemSubtitle(item: VaultItem): string {
  if (item.type === "login") return item.username || item.url || "Sem usuário"
  if (item.type === "card") return item.number ? `•••• ${item.number.slice(-4)}` : "Cartão"
  if (item.type === "document") return item.file?.name ?? "Documento"
  return "Nota segura"
}

/** One item as a list row: icon, name, a non-secret line and a neutral chip (the type, or `badges` such as "Fraca" / "Repetida"). */
export function ItemRow({ item, selected, onClick, badges }: { item: VaultItem; selected?: boolean; onClick: () => void; badges?: string[] }) {
  const Icon = ITEM_ICONS[item.type]
  return (
    <button
      type="button"
      data-item={item.id}
      data-selected={selected ?? false}
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
      className={cn(LIST_CARD, "flex min-h-[60px] w-full items-center gap-3 p-3 text-left outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none", selected && "border-primary bg-primary/[0.08] ring-1 ring-primary ring-inset hover:bg-primary/[0.12]")}
    >
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border">
        <Icon strokeWidth={1.75} className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-6 font-semibold">{item.name}</span>
        <span className="truncate text-[13px] leading-5 text-muted-foreground">{itemSubtitle(item)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {(badges ?? [VAULT_TYPE_LABELS[item.type]]).map((label) => (
          <span key={label} data-chip className={chip}>
            {label}
          </span>
        ))}
      </span>
    </button>
  )
}
