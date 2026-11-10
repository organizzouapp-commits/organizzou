import { describe, expect, it } from "vitest"

import { resolveContextualActions, screenOf } from "./resolve"

const none = { quick: null, primary: null, vaultLocked: false }

describe("screenOf", () => {
  it("reads the module from the path", () => {
    expect(screenOf("/dashboard")).toBe("")
    expect(screenOf("/dashboard/notas")).toBe("notas")
    expect(screenOf("/dashboard/estudos/x?y=1")).toBe("estudos")
    expect(screenOf("/login")).toBe("")
  })
})

describe("resolveContextualActions", () => {
  it("uses the screen's primary action", () => {
    expect(resolveContextualActions({ ...none, pathname: "/dashboard/tarefas", primary: { label: "Nova tarefa" } })).toEqual([{ id: "primary", label: "Nova tarefa", source: "page" }])
  })

  it("Notas offers both creations (the primary menu)", () => {
    const actions = resolveContextualActions({
      ...none,
      pathname: "/dashboard/notas",
      primary: { label: "Nova nota", menu: [{ id: "note", label: "Nova nota" }, { id: "folder", label: "Nova pasta" }] },
    })
    expect(actions.map((a) => a.label)).toEqual(["Nova nota", "Nova pasta"])
  })

  it("registered quick actions win over the primary action (Estudos per tab)", () => {
    const actions = resolveContextualActions({ ...none, pathname: "/dashboard/estudos", primary: { label: "Nova matéria" }, quick: [{ id: "deck", label: "Novo baralho" }] })
    expect(actions).toEqual([{ id: "deck", label: "Novo baralho", source: "page" }])
  })

  it("falls back to Captura rápida on Hoje and on unknown routes", () => {
    expect(resolveContextualActions({ ...none, pathname: "/dashboard" })).toEqual([{ id: "capture", label: "Captura rápida", source: "capture" }])
    expect(resolveContextualActions({ ...none, pathname: "/dashboard/algo-novo" })[0].source).toBe("capture")
  })

  it("Configurações and Ajuda never offer an add action", () => {
    expect(resolveContextualActions({ ...none, pathname: "/dashboard/configuracoes", primary: { label: "Salvar" } })[0].source).toBe("capture")
    expect(resolveContextualActions({ ...none, pathname: "/dashboard/ajuda" })[0].source).toBe("capture")
  })

  it("Cofre: Adicionar item only when unlocked, nothing at all while locked", () => {
    const primary = { label: "Adicionar item" }
    expect(resolveContextualActions({ ...none, pathname: "/dashboard/cofre", primary, vaultLocked: false }).map((a) => a.label)).toEqual(["Adicionar item"])
    expect(resolveContextualActions({ ...none, pathname: "/dashboard/cofre", primary, vaultLocked: true })).toEqual([])
  })

  it("a locked vault does not affect other screens", () => {
    expect(resolveContextualActions({ ...none, pathname: "/dashboard/notas", primary: { label: "Nova nota" }, vaultLocked: true })).toHaveLength(1)
  })
})
