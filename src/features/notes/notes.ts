// Pure helpers of the "Notas" tab: the list (search, folders, groups), the previews, the markdown buttons and the draft rule.
import type { NoteFolderRow, NoteRow } from "./types"

// ------------------------------------------------------------------ list

export type FolderKey = "all" | "pinned" | string
export type FolderEntry = { key: FolderKey; label: string; count: number }

/** The rows of the folder list: Todas, Fixadas, then the person's folders, each with how many notes it holds. */
export function folderEntries(notes: Pick<NoteRow, "folder_id" | "pinned">[], folders: Pick<NoteFolderRow, "id" | "name">[]): FolderEntry[] {
  return [
    { key: "all", label: "Todas", count: notes.length },
    { key: "pinned", label: "Fixadas", count: notes.filter((n) => n.pinned).length },
    ...folders.map((f) => ({ key: f.id, label: f.name, count: notes.filter((n) => n.folder_id === f.id).length })),
  ]
}

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Notes of a folder ("all", "pinned" or a folder id) whose title or body contains the query (ignoring case and accents), pinned first then newest. */
export function filterNotes<T extends Pick<NoteRow, "folder_id" | "pinned" | "title" | "body" | "updated_at">>(notes: T[], folder: FolderKey, query: string): T[] {
  const q = plain(query.trim())
  return notes
    .filter((n) => {
      if (folder === "pinned" ? !n.pinned : folder !== "all" && n.folder_id !== folder) return false
      return !q || plain(`${n.title} ${n.body}`).includes(q)
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at))
}

/** The two groups of the list, in order: Fixadas and Notas (empty ones left out). */
export function groupNotes<T extends Pick<NoteRow, "pinned">>(notes: T[]): { id: "pinned" | "others"; label: string; items: T[] }[] {
  return [
    { id: "pinned" as const, label: "Fixadas", items: notes.filter((n) => n.pinned) },
    { id: "others" as const, label: "Notas", items: notes.filter((n) => !n.pinned) },
  ].filter((g) => g.items.length > 0)
}

/** Plain text for the 2-line preview of a card: headings, bullets, checkboxes and bold/italic marks removed. */
export function excerpt(body: string, max = 160): string {
  const text = body
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+/, "")
        .replace(/^\s*[-•]\s+(\[[ xX]\]\s+)?/, "")
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

// ------------------------------------------------------------------ drafts

export const isEmptyNote = (note: Pick<NoteRow, "title" | "body">) => note.title.trim() === "" && note.body.trim() === ""

/** A draft is saved only once it has a title or some content. */
export const shouldPersistDraft = (draft: Pick<NoteRow, "title" | "body">) => !isEmptyNote(draft)

/** An empty draft is thrown away when the person leaves it. */
export const shouldDiscardDraft = (draft: Pick<NoteRow, "title" | "body"> | null) => draft !== null && isEmptyNote(draft)

/** "Nova nota": when an empty draft already exists it is reused (focus it) instead of making another one. */
export function startDraft<T extends Pick<NoteRow, "title" | "body">>(current: T | null, make: () => T): { draft: T; reused: boolean } {
  if (current && isEmptyNote(current)) return { draft: current, reused: true }
  return { draft: make(), reused: false }
}

// ------------------------------------------------------------------ copies and export

/** "Aula 1 — Revisão" → "aula-1-revisao" */
export function slugify(text: string): string {
  return plain(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "")
}

/** The .md file of a note: its title as the first heading, then the body. */
export function exportMarkdown(note: Pick<NoteRow, "title" | "body">): { filename: string; content: string } {
  const title = note.title.trim() || "Sem título"
  return { filename: `${slugify(title) || "nota"}.md`, content: `# ${title}\n\n${note.body.trimEnd()}\n` }
}

/** A copy of a note ("… (cópia)"), not pinned, in the same folder. */
export function duplicateNote(note: NoteRow, id: string, stamp: string): NoteRow {
  return { ...note, id, title: `${note.title.trim() || "Sem título"} (cópia)`, pinned: false, created_at: stamp, updated_at: stamp }
}

// ------------------------------------------------------------------ markdown buttons

export type MarkdownKind = "heading" | "bold" | "italic" | "list" | "checklist"
export type TextEdit = { text: string; start: number; end: number }

const LINE_PREFIX: Record<"heading" | "list" | "checklist", { prefix: string; test: RegExp }> = {
  heading: { prefix: "## ", test: /^#{1,2} / },
  checklist: { prefix: "- [ ] ", test: /^-\s+\[[ xX]\]\s/ },
  list: { prefix: "- ", test: /^[-•]\s(?!\[[ xX]\]\s)/ },
}
const ANY_PREFIX = /^(#{1,2} |-\s+\[[ xX]\]\s|[-•]\s)/

/**
 * What a formatting button does to the text, given the selection (start..end, equal when there is only a cursor):
 * bold and italic wrap the selection (or insert a placeholder) and unwrap it when it is already wrapped; heading, list and
 * checklist toggle a prefix on every line the selection touches. Returns the new text and selection.
 */
export function applyMarkdown(text: string, start: number, end: number, kind: MarkdownKind): TextEdit {
  if (kind === "bold" || kind === "italic") {
    const mark = kind === "bold" ? "**" : "*"
    const selected = text.slice(start, end)
    if (start === end) {
      const insert = `${mark}texto${mark}`
      return { text: text.slice(0, start) + insert + text.slice(end), start: start + mark.length, end: start + mark.length + "texto".length }
    }
    const wrappedInside = selected.length > mark.length * 2 && selected.startsWith(mark) && selected.endsWith(mark) && (kind === "bold" || (!selected.startsWith("**") && !selected.endsWith("**")))
    if (wrappedInside) {
      const inner = selected.slice(mark.length, -mark.length)
      return { text: text.slice(0, start) + inner + text.slice(end), start, end: start + inner.length }
    }
    const wrappedAround = text.slice(start - mark.length, start) === mark && text.slice(end, end + mark.length) === mark && (kind === "bold" || (text[start - 2] !== "*" && text[end + 1] !== "*"))
    if (wrappedAround) {
      return { text: text.slice(0, start - mark.length) + selected + text.slice(end + mark.length), start: start - mark.length, end: end - mark.length }
    }
    return { text: text.slice(0, start) + mark + selected + mark + text.slice(end), start: start + mark.length, end: end + mark.length }
  }

  const { prefix, test } = LINE_PREFIX[kind]
  const lineStart = text.lastIndexOf("\n", start - 1) + 1
  const touchedEnd = end > start && text[end - 1] === "\n" ? end - 1 : end
  const rawEnd = text.indexOf("\n", touchedEnd)
  const lineEnd = rawEnd === -1 ? text.length : rawEnd
  const lines = text.slice(lineStart, lineEnd).split("\n")
  const allHave = lines.every((l) => test.test(l))
  let firstDelta = 0
  let total = 0
  const next = lines.map((line, i) => {
    const existing = line.match(ANY_PREFIX)?.[0] ?? ""
    const changed = allHave ? line.slice(existing.length) : prefix + line.slice(existing.length)
    const delta = changed.length - line.length
    if (i === 0) firstDelta = delta
    total += delta
    return changed
  })
  return { text: text.slice(0, lineStart) + next.join("\n") + text.slice(lineEnd), start: Math.max(lineStart, start + firstDelta), end: Math.max(lineStart, end + total) }
}

/** Flips "- [ ]" and "- [x]" on one line of the body (the checkbox of the reading view). */
export function toggleCheckbox(body: string, line: number): string {
  const lines = body.split("\n")
  if (line < 0 || line >= lines.length) return body
  lines[line] = lines[line].replace(/^(\s*-\s+\[)([ xX])(\])/, (_m, a: string, state: string, c: string) => `${a}${state === " " ? "x" : " "}${c}`)
  return lines.join("\n")
}

export type PreviewLine = { kind: "heading" | "text" | "bullet" | "todo"; text: string; done?: boolean }

/** The first lines of a note for its card: headings, bullets and to-dos kept as such (so a checklist reads as one), marks removed, blanks skipped. */
export function previewLines(body: string, max = 6): PreviewLine[] {
  const clean = (text: string) => text.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1").trim()
  const out: PreviewLine[] = []
  for (const raw of body.split("\n")) {
    if (out.length === max) break
    const line = raw.trim()
    if (!line) continue
    const todo = /^[-•]\s+\[([ xX])\]\s+(.*)$/.exec(line)
    if (todo) out.push({ kind: "todo", text: clean(todo[2]), done: todo[1].toLowerCase() === "x" })
    else if (/^[-•]\s+/.test(line)) out.push({ kind: "bullet", text: clean(line.replace(/^[-•]\s+/, "")) })
    else if (/^#{1,6}\s+/.test(line)) out.push({ kind: "heading", text: clean(line.replace(/^#{1,6}\s+/, "")) })
    else out.push({ kind: "text", text: clean(line) })
  }
  return out
}
