import { CircleHelpIcon, SettingsIcon, type LucideIcon } from "lucide-react"

import { settingsHref } from "@/lib/settings-tabs"

/** Heading of the "Conta" section in the phone "Outros" sheet (the sidebar shows the two entries flat, with no heading). */
export const ACCOUNT_GROUP_LABEL = "Conta"

export type AccountItem = { id: string; label: string; href: string; icon: LucideIcon }

/** Flat account entries of the sidebar, the rail, the phone sheet and the palette. "Sair" is added by each surface (it asks for confirmation). */
export const ACCOUNT_ITEMS: AccountItem[] = [
  { id: "configuracoes", label: "Configurações", href: "/dashboard/configuracoes", icon: SettingsIcon },
  { id: "ajuda", label: "Ajuda", href: "/dashboard/ajuda", icon: CircleHelpIcon },
]

/** The avatar menu goes straight to two tabs of the settings page. */
export const AVATAR_LINKS = {
  settings: { label: "Configurações", href: settingsHref("perfil"), icon: SettingsIcon },
  plan: { label: "Plano e cobrança", href: settingsHref("plano") },
} as const
