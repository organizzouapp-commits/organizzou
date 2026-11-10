import { describe, expect, it } from "vitest"

import { LEGACY_SETTINGS_ROUTES, SETTINGS_TABS, legacySettingsRedirect, parseSettingsTab, settingsHref } from "./settings-tabs"

describe("parseSettingsTab", () => {
  it("accepts the five tabs", () => {
    expect(SETTINGS_TABS.map((t) => parseSettingsTab(t.id))).toEqual(["perfil", "aparencia", "avisos", "seguranca", "plano"])
  })

  it("falls back to perfil for a missing, unknown, wrongly cased or removed tab", () => {
    for (const bad of [undefined, null, "", "Plano", "nao-existe", "perfil "]) expect(parseSettingsTab(bad)).toBe("perfil")
  })

  it("uses the first value when the parameter is repeated", () => {
    expect(parseSettingsTab(["plano", "avisos"])).toBe("plano")
    expect(parseSettingsTab(["xyz", "plano"])).toBe("perfil")
    expect(parseSettingsTab([])).toBe("perfil")
  })
})

describe("settingsHref", () => {
  it("points at one tab of the single page", () => {
    expect(settingsHref("plano")).toBe("/dashboard/configuracoes?aba=plano")
    expect(settingsHref()).toBe("/dashboard/configuracoes?aba=perfil")
  })
})

describe("legacySettingsRedirect", () => {
  it("sends the old profile route to the Perfil tab and the old plan route to the Plano tab", () => {
    expect(legacySettingsRedirect("/dashboard/perfil")).toBe("/dashboard/configuracoes?aba=perfil")
    expect(legacySettingsRedirect("/dashboard/plano")).toBe("/dashboard/configuracoes?aba=plano")
    expect(legacySettingsRedirect("/dashboard/plano/")).toBe("/dashboard/configuracoes?aba=plano")
  })

  it("leaves Ajuda, the settings page itself and everything else alone", () => {
    for (const path of ["/dashboard/ajuda", "/dashboard/configuracoes", "/dashboard", "/dashboard/perfil/x"]) expect(legacySettingsRedirect(path)).toBeNull()
  })

  it("every legacy route leads to a real tab", () => {
    for (const route of LEGACY_SETTINGS_ROUTES) expect(SETTINGS_TABS.some((t) => t.id === route.tab)).toBe(true)
  })
})
