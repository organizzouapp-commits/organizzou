// Generates the installable-app icons (192, 512, maskable 512, 96 badge) from the brand icon. Run: node scripts/make-pwa-icons.mjs
import sharp from "sharp"

const source = "public/brand/organizzou-icone-1024.png"
await sharp(source).resize(192, 192).png().toFile("public/brand/pwa-192.png")
await sharp(source).resize(512, 512).png().toFile("public/brand/pwa-512.png")
// Maskable: the artwork sits inside the central 80% on a solid Lima field, so any launcher mask keeps it whole.
const inner = await sharp(source).resize(410, 410).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#DBFD00" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/brand/pwa-maskable-512.png")
// Notification badge: a small monochrome mark (Android shows only the alpha channel).
await sharp(source).resize(96, 96).greyscale().png().toFile("public/brand/pwa-badge-96.png")
console.log("icons written")
