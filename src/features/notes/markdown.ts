export type Inline = { text: string; bold?: boolean; italic?: boolean }

export type Block =
  | { type: "heading"; level: 1 | 2; inline: Inline[] }
  | { type: "list"; items: Inline[][] }
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

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  let list: Inline[][] | null = null

  const flush = () => {
    if (list) blocks.push({ type: "list", items: list })
    list = null
  }

  for (const raw of source.split("\n")) {
    const line = raw.trimEnd()
    if (/^\s*[-•]\s+/.test(line)) {
      list = list ?? []
      list.push(parseInline(line.replace(/^\s*[-•]\s+/, "")))
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
