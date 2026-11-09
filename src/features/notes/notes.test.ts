import { describe, expect, it } from "vitest"

import { parseMarkdown, wordCount } from "./markdown"
import { applyMarkdown, duplicateNote, excerpt, exportMarkdown, filterNotes, folderEntries, groupNotes, isEmptyNote, shouldDiscardDraft, shouldPersistDraft, slugify, startDraft, toggleCheckbox } from "./notes"
import type { NoteRow } from "./types"

const note = (over: Partial<NoteRow> = {}): NoteRow => ({ id: "n", user_id: "u", folder_id: null, title: "", body: "", pinned: false, tags: [], created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z", ...over })

describe("wordCount", () => {
  it("counts words", () => {
    expect(wordCount("")).toBe(0)
    expect(wordCount("  \n ")).toBe(0)
    expect(wordCount("um dois\ntrês  quatro")).toBe(4)
  })
})

describe("excerpt", () => {
  it("strips markdown marks and joins the lines", () => {
    expect(excerpt("# Título\n\n- primeiro **item**\n- [ ] segundo *item*\n- [x] feito")).toBe("Título primeiro item segundo item feito")
  })
  it("cuts long text with an ellipsis", () => {
    const out = excerpt("palavra ".repeat(60), 50)
    expect(out.endsWith("…")).toBe(true)
    expect(out.length).toBeLessThanOrEqual(51)
  })
  it("is empty for an empty note", () => expect(excerpt("  \n ")).toBe(""))
})

describe("folderEntries", () => {
  const notes = [{ folder_id: "a", pinned: true }, { folder_id: "a", pinned: false }, { folder_id: null, pinned: true }, { folder_id: "b", pinned: false }]
  it("counts Todas, Fixadas and each folder", () => {
    expect(folderEntries(notes, [{ id: "a", name: "Estudos" }, { id: "b", name: "Casa" }, { id: "c", name: "Vazia" }])).toEqual([
      { key: "all", label: "Todas", count: 4 },
      { key: "pinned", label: "Fixadas", count: 2 },
      { key: "a", label: "Estudos", count: 2 },
      { key: "b", label: "Casa", count: 1 },
      { key: "c", label: "Vazia", count: 0 },
    ])
  })
})

describe("filterNotes and groupNotes", () => {
  const list = [
    note({ id: "1", title: "Café", body: "moer na hora", updated_at: "2026-11-02T10:00:00Z" }),
    note({ id: "2", title: "Reunião", body: "pauta do cafezinho", folder_id: "f", updated_at: "2026-11-05T10:00:00Z" }),
    note({ id: "3", title: "Ideias", body: "", pinned: true, updated_at: "2026-10-01T10:00:00Z" }),
  ]
  it("orders pinned first, then newest", () => {
    expect(filterNotes(list, "all", "").map((n) => n.id)).toEqual(["3", "2", "1"])
  })
  it("filters by folder and by pinned", () => {
    expect(filterNotes(list, "f", "").map((n) => n.id)).toEqual(["2"])
    expect(filterNotes(list, "pinned", "").map((n) => n.id)).toEqual(["3"])
  })
  it("searches title and body, ignoring case and accents", () => {
    expect(filterNotes(list, "all", "CAFE").map((n) => n.id)).toEqual(["2", "1"])
    expect(filterNotes(list, "all", "reuniao").map((n) => n.id)).toEqual(["2"])
    expect(filterNotes(list, "all", "nada disso")).toEqual([])
  })
  it("combines a folder with a search", () => {
    expect(filterNotes(list, "f", "moer")).toEqual([])
  })
  it("groups into Fixadas and Notas, leaving empty groups out", () => {
    expect(groupNotes(filterNotes(list, "all", "")).map((g) => [g.id, g.items.length])).toEqual([["pinned", 1], ["others", 2]])
    expect(groupNotes([note({ pinned: false })]).map((g) => g.id)).toEqual(["others"])
    expect(groupNotes([])).toEqual([])
  })
})

describe("draft rule", () => {
  it("knows an empty note", () => {
    expect(isEmptyNote(note())).toBe(true)
    expect(isEmptyNote(note({ title: "  ", body: "\n" }))).toBe(true)
    expect(isEmptyNote(note({ title: "A" }))).toBe(false)
    expect(isEmptyNote(note({ body: "texto" }))).toBe(false)
  })
  it("persists a draft only when it has a title or content", () => {
    expect(shouldPersistDraft(note())).toBe(false)
    expect(shouldPersistDraft(note({ title: "Ideia" }))).toBe(true)
    expect(shouldPersistDraft(note({ body: "algo" }))).toBe(true)
  })
  it("discards an empty draft when leaving it, keeps a filled one and does nothing without a draft", () => {
    expect(shouldDiscardDraft(note())).toBe(true)
    expect(shouldDiscardDraft(note({ title: "x" }))).toBe(false)
    expect(shouldDiscardDraft(null)).toBe(false)
  })
  it("reuses the empty draft instead of creating another one", () => {
    let made = 0
    const make = () => note({ id: `new-${++made}` })
    const first = startDraft(null, make)
    expect(first).toMatchObject({ reused: false, draft: { id: "new-1" } })
    const again = startDraft(first.draft, make)
    expect(again.reused).toBe(true)
    expect(again.draft).toBe(first.draft)
    expect(made).toBe(1)
    // Clicking "Nova nota" many times still yields one draft.
    let draft = first.draft
    for (let i = 0; i < 5; i++) draft = startDraft(draft, make).draft
    expect(made).toBe(1)
  })
  it("makes a fresh draft once the previous one has content", () => {
    const filled = note({ id: "old", title: "Pronta" })
    expect(startDraft(filled, () => note({ id: "fresh" }))).toMatchObject({ reused: false, draft: { id: "fresh" } })
  })
})

describe("slugify, export and duplicate", () => {
  it("makes a file-safe slug", () => {
    expect(slugify("Aula 1 — Revisão de Cálculo!")).toBe("aula-1-revisao-de-calculo")
    expect(slugify("   ")).toBe("")
    expect(slugify("a".repeat(100)).length).toBe(60)
  })
  it("exports a .md with the title as heading", () => {
    expect(exportMarkdown({ title: "Lista de compras", body: "- pão\n- leite\n\n" })).toEqual({ filename: "lista-de-compras.md", content: "# Lista de compras\n\n- pão\n- leite\n" })
    expect(exportMarkdown({ title: "", body: "oi" })).toEqual({ filename: "sem-titulo.md", content: "# Sem título\n\noi\n" })
    expect(exportMarkdown({ title: "???", body: "" }).filename).toBe("nota.md")
  })
  it("duplicates without pinning and with a new id", () => {
    const copy = duplicateNote(note({ id: "old", title: "Ideia", body: "texto", pinned: true, folder_id: "f" }), "new", "2026-11-09T10:00:00Z")
    expect(copy).toMatchObject({ id: "new", title: "Ideia (cópia)", body: "texto", pinned: false, folder_id: "f", created_at: "2026-11-09T10:00:00Z" })
  })
})

describe("applyMarkdown: bold and italic", () => {
  it("inserts a placeholder at the cursor and selects it", () => {
    expect(applyMarkdown("oi ", 3, 3, "bold")).toEqual({ text: "oi **texto**", start: 5, end: 10 })
  })
  it("wraps the selection and keeps it selected", () => {
    expect(applyMarkdown("uma palavra aqui", 4, 11, "bold")).toEqual({ text: "uma **palavra** aqui", start: 6, end: 13 })
    expect(applyMarkdown("uma palavra aqui", 4, 11, "italic")).toEqual({ text: "uma *palavra* aqui", start: 5, end: 12 })
  })
  it("unwraps when the selection already carries the marks", () => {
    expect(applyMarkdown("uma **palavra** aqui", 4, 15, "bold")).toEqual({ text: "uma palavra aqui", start: 4, end: 11 })
  })
  it("unwraps when the marks sit just outside the selection", () => {
    expect(applyMarkdown("uma **palavra** aqui", 6, 13, "bold")).toEqual({ text: "uma palavra aqui", start: 4, end: 11 })
  })
  it("does not mistake bold for italic", () => {
    const out = applyMarkdown("uma **palavra** aqui", 4, 15, "italic")
    expect(out.text).toBe("uma ***palavra*** aqui")
  })
})

describe("applyMarkdown: line prefixes", () => {
  it("adds and removes the heading prefix", () => {
    const on = applyMarkdown("título\ncorpo", 2, 2, "heading")
    expect(on).toEqual({ text: "## título\ncorpo", start: 5, end: 5 })
    expect(applyMarkdown(on.text, on.start, on.end, "heading").text).toBe("título\ncorpo")
    expect(applyMarkdown("# antigo", 0, 0, "heading").text).toBe("antigo")
  })
  it("toggles a list on every touched line", () => {
    const on = applyMarkdown("a\nb\nc", 0, 3, "list")
    expect(on.text).toBe("- a\n- b\nc")
    expect(applyMarkdown(on.text, on.start, on.end, "list").text).toBe("a\nb\nc")
  })
  it("switches between list, checklist and heading instead of stacking prefixes", () => {
    expect(applyMarkdown("- item", 0, 0, "checklist").text).toBe("- [ ] item")
    expect(applyMarkdown("- [ ] item", 0, 0, "list").text).toBe("- item")
    expect(applyMarkdown("- [x] feito", 0, 0, "checklist").text).toBe("feito")
    expect(applyMarkdown("- item", 0, 0, "heading").text).toBe("## item")
  })
  it("adds a prefix to a mixed selection, removes only when every line has it", () => {
    expect(applyMarkdown("- a\nb", 0, 5, "list").text).toBe("- a\n- b")
    expect(applyMarkdown("- a\n- b", 0, 7, "list").text).toBe("a\nb")
  })
  it("works on an empty text and on the last line", () => {
    expect(applyMarkdown("", 0, 0, "checklist")).toEqual({ text: "- [ ] ", start: 6, end: 6 })
    expect(applyMarkdown("um\ndois", 5, 5, "list").text).toBe("um\n- dois")
  })
})

describe("checklists", () => {
  it("parses checkboxes apart from bullets, keeping the line index", () => {
    const blocks = parseMarkdown("- a\n- [ ] b\n- [x] c\ntexto")
    expect(blocks.map((b) => b.type)).toEqual(["list", "checklist", "paragraph"])
    const check = blocks[1]
    expect(check.type === "checklist" && check.items.map((i) => [i.line, i.checked])).toEqual([[1, false], [2, true]])
  })
  it("toggles a checkbox in the source", () => {
    expect(toggleCheckbox("- [ ] a\n- [x] b", 0)).toBe("- [x] a\n- [x] b")
    expect(toggleCheckbox("- [ ] a\n- [x] b", 1)).toBe("- [ ] a\n- [ ] b")
    expect(toggleCheckbox("- [ ] a", 5)).toBe("- [ ] a")
    expect(toggleCheckbox("texto", 0)).toBe("texto")
  })
})
