// The tabs of the Configurações page and the old routes that now point into it. Pure: used by the page, the menus, next.config and tests.

export const SETTINGS_TABS = [
  { id: "perfil", label: "Perfil" },
  { id: "aparencia", label: "Aparência" },
  { id: "avisos", label: "Avisos" },
  { id: "seguranca", label: "Segurança e dados" },
  { id: "plano", label: "Plano e cobrança" },
] as const

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"]

export const DEFAULT_SETTINGS_TAB: SettingsTab = "perfil"
export const SETTINGS_PATH = "/dashboard/configuracoes"

/** The tab named by the `aba` query parameter; anything missing, repeated or unknown (an old a typo) is the Perfil tab. */
export function parseSettingsTab(aba: string | string[] | null | undefined): SettingsTab {
  const value = Array.isArray(aba) ? aba[0] : aba
  return SETTINGS_TABS.some((tab) => tab.id === value) ? (value as SettingsTab) : DEFAULT_SETTINGS_TAB
}

/** Link to one tab of the page, e.g. /dashboard/configuracoes?aba=plano. */
export function settingsHref(tab: SettingsTab = DEFAULT_SETTINGS_TAB): string {
  return `${SETTINGS_PATH}?aba=${tab}`
}

/** Routes that used to be pages of their own, and the tab that replaces each of them (/dashboard/ajuda stays a page). */
export const LEGACY_SETTINGS_ROUTES: { source: string; tab: SettingsTab }[] = [
  { source: "/dashboard/perfil", tab: "perfil" },
  { source: "/dashboard/plano", tab: "plano" },
]

/** Where an old route goes now, or null when the path is not one of them. */
export function legacySettingsRedirect(pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  const found = LEGACY_SETTINGS_ROUTES.find((route) => route.source === clean)
  return found ? settingsHref(found.tab) : null
}
