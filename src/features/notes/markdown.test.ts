import { describe, expect, it } from "vitest"

import { parseInline, parseMarkdown, wordCount } from "./markdown"

describe("parseInline", () => {
  it("styles bold and italic runs", () => {
    expect(parseInline("um **forte** e *leve* texto")).toEqual([
      { text: "um " },
      { text: "forte", bold: true },
      { text: " e " },
      { text: "leve", italic: true },
      { text: " texto" },
    ])
  })

  it("keeps unclosed markers as text", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ text: "2 * 3 = 6" }])
  })
})

describe("parseMarkdown", () => {
  it("builds headings, lists and paragraphs", () => {
    const blocks = parseMarkdown("# Título\n\nTexto **ok**\n- um\n- dois\n## Seção")
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "heading"])
    const list = blocks[2]
    expect(list.type === "list" && list.items).toHaveLength(2)
  })
})

describe("wordCount", () => {
  it("counts words ignoring extra whitespace", () => {
    expect(wordCount("  um  dois\ntrês ")).toBe(3)
    expect(wordCount("")).toBe(0)
  })
})
