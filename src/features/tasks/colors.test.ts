import { describe, expect, it } from "vitest"

import { BUILT_IN_COLORS, colorLabel, columnSwatchFor, EMPTY_LABEL_COLORS, MAX_CUSTOM_COLORS, parseLabelColors, resolveHex, taskColorOf, withColor, withCustom, withoutCustom } from "./colors"

describe("label colors", () => {
  it("resolves swatch ids and hex, and nothing else", () => {
    expect(resolveHex("lima")).toBe("#DBFD00")
    expect(resolveHex("vermelho")).toBe("var(--label-red)")
    expect(colorLabel("verde")).toBe("Verde")
    expect(BUILT_IN_COLORS.map((c) => c.id)).toEqual(["vermelho", "amarelo", "azul", "laranja", "verde"])
    expect(resolveHex("#abcdef")).toBe("#ABCDEF")
    expect(resolveHex("red")).toBeNull()
    expect(resolveHex(null)).toBeNull()
    expect(colorLabel(null)).toBe("Sem cor")
    expect(colorLabel("lima-verso")).toBe("Lima verso")
  })

  it("sets and clears a color per kind without touching the others", () => {
    const a = withColor(EMPTY_LABEL_COLORS, "tag", "t1", "#FF8800")
    expect(a.colors.tag.t1).toBe("#FF8800")
    expect(a.colors.priority).toEqual({})
    expect(withColor(a, "tag", "t1", null).colors.tag).toEqual({})
  })

  it("keeps at most 8 distinct, valid custom colors", () => {
    let state = EMPTY_LABEL_COLORS
    for (const hex of ["#111111", "#222222", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777", "#888888", "#999999", "nope"]) state = withCustom(state, hex)
    expect(state.custom).toEqual(["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777", "#888888"])
    expect(state.custom).toHaveLength(MAX_CUSTOM_COLORS)
    expect(withoutCustom(state, "#222222").custom).not.toContain("#222222")
  })

  it("reads broken storage tolerantly", () => {
    expect(parseLabelColors("{not json")).toEqual(EMPTY_LABEL_COLORS)
    const parsed = parseLabelColors(JSON.stringify({ colors: { tag: { a: "#ff0000", b: "javascript:1", c: null } }, custom: ["#00ff00", "x", "#00ff00"] }))
    expect(parsed.colors.tag).toEqual({ a: "#ff0000", c: null })
    expect(parsed.custom).toEqual(["#00FF00"])
  })

  it("task color: the local choice wins, else the palette swatch of the column; neutro means Sem cor", () => {
    expect(taskColorOf(EMPTY_LABEL_COLORS, { id: "t", swatch: "neutro" })).toBeNull()
    expect(taskColorOf(EMPTY_LABEL_COLORS, { id: "t", swatch: "lima" })).toBe("lima")
    const local = withColor(EMPTY_LABEL_COLORS, "task", "t", "#123456")
    expect(taskColorOf(local, { id: "t", swatch: "lima" })).toBe("#123456")
  })

  it("only palette swatches go to the tasks.swatch column", () => {
    expect(columnSwatchFor("lima")).toBe("lima")
    expect(columnSwatchFor("cinza")).toBe("neutro")
    expect(columnSwatchFor("vermelho")).toBe("neutro")
    expect(columnSwatchFor("#123456")).toBe("neutro")
    expect(columnSwatchFor(null)).toBe("neutro")
  })
})
