// Finds imports whose path casing differs from the real file or folder name. Windows and macOS do not care; Vercel (Linux) does,
// and the build then fails with "Module not found". Run: node scripts/check-import-case.mjs  (exit 1 when something is wrong)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"

const root = resolve(import.meta.dirname, "..")
const SKIP = new Set(["node_modules", ".next", ".git", "test-results", "imagens"])
const walk = (dir) => readdirSync(dir).flatMap((n) => (SKIP.has(n) || n.startsWith(".next") ? [] : statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))
const files = walk(root).filter((f) => /\.(ts|tsx|mts|mjs|js|jsx|css)$/.test(f) && !f.includes(`${sep}supabase${sep}types`))

const EXT = ["", ".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json", ".css", "/index.ts", "/index.tsx", "/index.js"]
const ALIAS = [["@/", join(root, "src") + sep]]

/** True when every segment of `path` exists with exactly this casing. */
function exactCase(path) {
  const parts = relative(root, path).split(sep)
  let cur = root
  for (const part of parts) {
    if (!readdirSync(cur).includes(part)) return false
    cur = join(cur, part)
  }
  return true
}

const problems = []
const importRe = /(?:from\s+|import\s*\(\s*|import\s+|require\(\s*|@import\s+)["']([^"']+)["']/g
for (const file of files) {
  const text = readFileSync(file, "utf8")
  for (const m of text.matchAll(importRe)) {
    const spec = m[1]
    let base = null
    for (const [prefix, dir] of ALIAS) if (spec.startsWith(prefix)) base = dir + spec.slice(prefix.length)
    if (!base && (spec.startsWith("./") || spec.startsWith("../"))) base = resolve(dirname(file), spec)
    if (!base) continue
    const hit = EXT.map((e) => base + e.replace("/", sep)).find((p) => existsSync(p) && statSync(p).isFile())
    if (!hit) continue // not a file we can check (asset, virtual module, generated type)
    if (!exactCase(hit)) problems.push(`${relative(root, file)}: "${spec}" does not match the casing on disk`)
  }
}

if (problems.length) {
  console.error(problems.join("\n"))
  process.exit(1)
}
console.log(`Import casing OK (${files.length} files checked).`)
