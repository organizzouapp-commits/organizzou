// A small PWA audit (the checks Lighthouse makes for "installable", offline of any network): run `node scripts/check-pwa.mjs` against the
// source. It reads src/app/manifest.ts as text, so it needs no server.
import { existsSync, readFileSync } from "node:fs"

const manifestSource = readFileSync("src/app/manifest.ts", "utf8")
const checks = []
const ok = (name, pass, hint = "") => checks.push({ name, pass: Boolean(pass), hint })

const field = (key) => new RegExp(key + ": *\"([^\"]+)\"").exec(manifestSource)?.[1]
ok("name", field("name"))
ok("short_name", field("short_name"))
ok("start_url", field("start_url"), "start_url must be set")
ok("scope", field("scope"))
ok("display standalone", field("display") === "standalone")
ok("theme_color", /^#[0-9a-fA-F]{6}$/.test(field("theme_color") ?? ""))
ok("background_color", /^#[0-9a-fA-F]{6}$/.test(field("background_color") ?? ""))
ok("lang", field("lang"))
const icons = [...manifestSource.matchAll(/src:\s*"([^"]+)",\s*sizes:\s*"([^"]+)",\s*type:\s*"([^"]+)"(?:,\s*purpose:\s*"([^"]+)")?/g)].map((m) => ({ src: m[1], sizes: m[2], purpose: m[4] ?? "any" }))
ok("icon 192x192 (any)", icons.some((i) => i.sizes === "192x192" && i.purpose === "any"))
ok("icon 512x512 (any)", icons.some((i) => i.sizes === "512x512" && i.purpose === "any"))
ok("icon maskable 512", icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable"))
ok("every icon file exists", icons.every((i) => existsSync(`public${i.src}`)), icons.filter((i) => !existsSync(`public${i.src}`)).map((i) => i.src).join(", "))
ok("service worker file", existsSync("public/sw.js"))
const sw = existsSync("public/sw.js") ? readFileSync("public/sw.js", "utf8") : ""
ok("sw handles push", /addEventListener\("push"/.test(sw))
ok("sw handles notificationclick", /addEventListener\("notificationclick"/.test(sw))
ok("sw has an update path (SKIP_WAITING)", /SKIP_WAITING/.test(sw))
ok("sw does not cache API or auth responses", !/caches\./.test(sw))
ok("apple touch icon / favicon present", existsSync("src/app/favicon.ico"))
const layout = readFileSync("src/app/layout.tsx", "utf8")
ok("viewport / theme color in the layout", /themeColor|viewport/i.test(layout), "export a viewport with themeColor so the browser UI matches")
ok("apple-touch-icon declared", /apple/i.test(layout), "add icons.apple for iOS Add to Home Screen")

let failed = 0
for (const c of checks) {
  if (!c.pass) failed++
  console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.pass || !c.hint ? "" : `  (${c.hint})`}`)
}
console.log(`\n${checks.length - failed}/${checks.length} checks pass`)
process.exit(failed ? 1 : 0)
