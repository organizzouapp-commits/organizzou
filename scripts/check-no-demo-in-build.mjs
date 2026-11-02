// After `npm run build`: fails if any piece of the demo content ended up in what the app ships. The demo lives only in the database
// (scripts/demo/content.ts, loaded by `npm run seed:demo`); the application code must contain none of it.
//   npm run build && npm run check:no-demo
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const SAMPLES = ["relatório semanal à Marina", "Consulta com a Dra. Camila", "Beber 2,5 litros", "Conta Nubank", "Direito Constitucional", "Treino A — Peito", "Smart Fit", "Sapiens — Yuval", "Pagar IPTU", "Dona Lucinha"]
const roots = [join(".next", "static"), join(".next", "server")]

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) yield* files(full)
    else if (/\.(js|html|rsc|json)$/.test(name) && !name.endsWith(".map")) yield full
  }
}

const hits = []
for (const root of roots) {
  try {
    for (const file of files(root)) {
      const text = readFileSync(file, "utf8")
      for (const sample of SAMPLES) if (text.includes(sample)) hits.push(`${file}: "${sample}"`)
    }
  } catch {
    console.error(`Não achei ${root}. Rode "npm run build" antes.`)
    process.exit(1)
  }
}
if (hits.length > 0) {
  console.error("Conteúdo de demonstração dentro do build:\n" + hits.slice(0, 20).join("\n"))
  process.exit(1)
}
console.log("Nenhum conteúdo de demonstração no build.")
