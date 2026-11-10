"use client"

import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { LifeBuoyIcon, PlusIcon, SearchIcon, SparklesIcon, ZapIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-context"
import { usePrimaryActionValue, useQuickActionsValue } from "@/components/shell/primary-action"
import type { FabItem } from "@/components/shell/quick-actions-fab"
import { resolveContextualActions } from "@/features/quick-actions/resolve"

/**
 * The items of the quick-actions button, from the button upward: the screen's own add action(s) (resolved by route, with the same handlers
 * as the page header button), then "Falar com o assistente", "Pesquisar" and "Ajuda". Only labels and handlers pass through here, never
 * vault content: the Cofre screen registers its action only while unlocked.
 */
export function useQuickActionItems(): FabItem[] {
  const { openAssistant, openQuickCapture, openSearch } = useAssistant()
  const router = useRouter()
  const pathname = usePathname()
  const primary = usePrimaryActionValue()
  const quick = useQuickActionsValue()

  return useMemo(() => {
    const contextual = resolveContextualActions({ pathname, quick, primary })
    const handlerOf = (id: string, source: "page" | "capture"): (() => void) => {
      if (source === "capture") return openQuickCapture
      if (id === "primary") return () => primary?.onClick()
      return () => (quick?.find((item) => item.id === id) ?? primary?.menu?.find((item) => item.id === id))?.onSelect()
    }
    return [
      ...contextual.map<FabItem>((action) => ({ id: action.source === "capture" ? "capture" : `add-${action.id}`, label: action.label, icon: action.source === "capture" ? ZapIcon : PlusIcon, contextual: true, onSelect: handlerOf(action.id, action.source) })),
      { id: "assistant", label: "Falar com o assistente", icon: SparklesIcon, onSelect: openAssistant },
      { id: "search", label: "Pesquisar", icon: SearchIcon, onSelect: openSearch },
      { id: "help", label: "Ajuda", icon: LifeBuoyIcon, onSelect: () => router.push("/dashboard/ajuda") },
    ]
  }, [pathname, quick, primary, openAssistant, openQuickCapture, openSearch, router])
}
