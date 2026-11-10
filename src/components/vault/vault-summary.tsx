"use client"

import { CopyCheckIcon, KeyRoundIcon, ShieldAlertIcon } from "lucide-react"

import { BentoStat } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { HeroCard } from "@/components/finance/parts"
import type { VaultHealth } from "@/features/vault/health"

const dim = (text: string) => <span className="text-[16px] leading-6 opacity-60">{text}</span>

/**
 * The four numbers on top of the Itens tab: how healthy the passwords are, how many items there are, how many passwords are weak and how many
 * repeat. Everything comes from vaultHealth (counts only, computed here on the device). Four cards in a row on desktop, a swiper on phones.
 */
export function VaultSummary({ health, mobile, onReview }: { health: VaultHealth; mobile: boolean; onReview: () => void }) {
  const height = mobile ? "h-[200px]" : "h-48"
  const hero = (
    <HeroCard
      key="hero"
      className={height}
      density="dense"
      label="Saúde do cofre"
      value={health.percent === null ? "—" : <>{health.percent} {dim("%")}</>}
      support={health.passwords === 0 ? "Nenhuma senha guardada ainda" : `${health.strongUnique} de ${health.passwords} ${health.passwords === 1 ? "senha forte e única" : "senhas fortes e únicas"}`}
      progress={{ value: health.percent ?? 0, label: `Saúde do cofre: ${health.percent ?? 0}%` }}
    />
  )
  const items = (
    <BentoStat key="items" label="Itens" icon={KeyRoundIcon} className={height} chip={`${health.byType.login} ${health.byType.login === 1 ? "senha" : "senhas"} · ${health.byType.card} ${health.byType.card === 1 ? "cartão" : "cartões"}`}>
      {health.items}
    </BentoStat>
  )
  const weak = (
    <button key="weak" type="button" data-testid="weak-card" aria-label={`Senhas fracas: ${health.weakIds.length}. Revisar no relatório de segurança`} onClick={onReview} className="block h-full w-full rounded-[20px] text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&>*]:h-full">
      <BentoStat label="Senhas fracas" icon={ShieldAlertIcon} className={height} chip="revisar">
        {health.weakIds.length}
      </BentoStat>
    </button>
  )
  const repeated = (
    <BentoStat key="repeated" label="Repetidas" icon={CopyCheckIcon} className={height} chip={`em ${health.reusedItems} ${health.reusedItems === 1 ? "item" : "itens"}`}>
      {health.reusedGroups.length}
    </BentoStat>
  )

  if (mobile) {
    return (
      <FinanceDeck
        title={null}
        label="Resumo do cofre"
        noun="resumo"
        initialHeight={200}
        slides={[
          { id: "hero", hero: true, node: hero },
          { id: "items", node: items },
          { id: "weak", node: weak },
          { id: "repeated", node: repeated },
        ]}
      />
    )
  }
  return (
    <div data-testid="vault-summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[hero, items, weak, repeated].map((card, i) => (
        <div key={i} className="flex min-w-0 flex-col">
          {card}
        </div>
      ))}
    </div>
  )
}
