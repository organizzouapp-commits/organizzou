import { CircleHelpIcon, SettingsIcon, UserIcon, type LucideIcon } from "lucide-react"

import { settingsHref } from "@/lib/settings-tabs"

/** Heading of the "Conta" section in the phone "Outros" sheet (the sidebar shows the two entries flat, with no heading). */
export const ACCOUNT_GROUP_LABEL = "Conta"

export type AccountItem = { id: string; label: string; href: string; icon: LucideIcon }

/** Flat account entries of the sidebar, the rail, the phone sheet and the palette. "Sair" is added by each surface (it asks for confirmation). */
export const ACCOUNT_ITEMS: AccountItem[] = [
  { id: "configuracoes", label: "Configurações", href: "/dashboard/configuracoes", icon: SettingsIcon },
  { id: "ajuda", label: "Ajuda", href: "/dashboard/ajuda", icon: CircleHelpIcon },
]

/**
 * The avatar menu: Perfil, Ajuda and Configurações (which opens the first tab after Perfil, so the two do not duplicate each other).
 * The plan is reached from the plan chip's arrow in the menu card (and the Plano e cobrança tab), not from a menu item.
 */
export const AVATAR_LINKS = {
  profile: { label: "Perfil", href: settingsHref("perfil"), icon: UserIcon },
  help: { label: "Ajuda", href: "/dashboard/ajuda", icon: CircleHelpIcon },
  settings: { label: "Configurações", href: settingsHref("avisos"), icon: SettingsIcon },
  plan: { label: "Plano e cobrança", href: settingsHref("plano") },
} as const
