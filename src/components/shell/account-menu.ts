import { CircleHelpIcon, SettingsIcon, UserIcon, type LucideIcon } from "lucide-react"

/** The "Configurações" group: the same items in the sidebar, the collapsed rail flyout, the top-bar avatar menu and the mobile "Mais" sheet. "Sair" is added by each surface (it asks for confirmation). */
export const ACCOUNT_GROUP_LABEL = "Configurações"

export type AccountItem = { id: string; label: string; href: string; icon: LucideIcon }

export const ACCOUNT_ITEMS: AccountItem[] = [
  { id: "perfil", label: "Perfil", href: "/dashboard/perfil", icon: UserIcon },
  { id: "configuracoes", label: "Configurações", href: "/dashboard/configuracoes", icon: SettingsIcon },
  { id: "ajuda", label: "Ajuda", href: "/dashboard/ajuda", icon: CircleHelpIcon },
]
