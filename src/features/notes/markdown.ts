export type Inline = { text: string; bold?: boolean; italic?: boolean }

export type ChecklistItem = { /** Index of the line in the source, to toggle it. */ line: number; checked: boolean; inline: Inline[] }

export type Block =
  | { type: "heading"; level: 1 | 2; inline: Inline[] }
  | { type: "list"; items: Inline[][] }
  /** "- [ ] item" / "- [x] item". */
  | { type: "checklist"; items: ChecklistItem[] }
  | { type: "paragraph"; inline: Inline[] }

/** Splits "a **b** *c*" into styled runs. Unclosed markers stay as plain text. */
export function parseInline(text: string): Inline[] {
  const runs: Inline[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) runs.push({ text: text.slice(last, index) })
    const token = match[0]
    if (token.startsWith("**")) runs.push({ text: token.slice(2, -2), bold: true })
    else runs.push({ text: token.slice(1, -1), italic: true })
    last = index + token.length
  }
  if (last < text.length) runs.push({ text: text.slice(last) })
  return runs.length > 0 ? runs : [{ text }]
}

const CHECK = /^\s*-\s+\[([ xX])\]\s+(.*)$/
const BULLET = /^\s*[-•]\s+/

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  let list: Inline[][] | null = null
  let checks: ChecklistItem[] | null = null

  const flush = () => {
    if (list) blocks.push({ type: "list", items: list })
    if (checks) blocks.push({ type: "checklist", items: checks })
    list = null
    checks = null
  }

  const lines = source.split("\n")
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trimEnd()
    const check = line.match(CHECK)
    if (check) {
      if (list) flush()
      checks = checks ?? []
      checks.push({ line: index, checked: check[1] !== " ", inline: parseInline(check[2]) })
      continue
    }
    if (BULLET.test(line)) {
      if (checks) flush()
      list = list ?? []
      list.push(parseInline(line.replace(BULLET, "")))
      continue
    }
    flush()
    if (!line.trim()) continue
    if (line.startsWith("## ")) blocks.push({ type: "heading", level: 2, inline: parseInline(line.slice(3)) })
    else if (line.startsWith("# ")) blocks.push({ type: "heading", level: 1, inline: parseInline(line.slice(2)) })
    else blocks.push({ type: "paragraph", inline: parseInline(line) })
  }
  flush()
  return blocks
}

export function wordCount(source: string) {
  return source.trim() ? source.trim().split(/\s+/).length : 0
}
