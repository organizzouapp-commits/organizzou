"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { LifeBuoyIcon, SearchIcon, SparklesIcon, ZapIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-context"
import type { FabItem } from "@/components/shell/quick-actions-fab"

/** The items of the quick-actions button, from the button upward: the screen's own action(s) first, then the global ones. */
export function useQuickActionItems(): FabItem[] {
  const { openAssistant, openQuickCapture, openSearch } = useAssistant()
  const router = useRouter()
  return useMemo(
    () => [
      { id: "capture", label: "Captura rápida", icon: ZapIcon, contextual: true, onSelect: openQuickCapture },
      { id: "assistant", label: "Falar com o assistente", icon: SparklesIcon, onSelect: openAssistant },
      { id: "search", label: "Pesquisar", icon: SearchIcon, onSelect: openSearch },
      { id: "help", label: "Ajuda", icon: LifeBuoyIcon, onSelect: () => router.push("/dashboard/ajuda") },
    ],
    [openAssistant, openQuickCapture, openSearch, router]
  )
}
