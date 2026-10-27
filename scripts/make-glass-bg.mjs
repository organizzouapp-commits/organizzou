// Pre-renders the app background from the auth photo: a TINY pre-blurred WebP (64 px wide desktop, 36 px wide mobile, ~1 KB each).
// The browser upscales it with object-fit: cover and the upscaling is the blur, so the app needs no CSS filter or backdrop-filter.
// Uses the sharp that Next.js already installs. Run after changing the auth background:
//   npm run glass-bg
import { stat } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

const dir = path.join(process.cwd(), "public", "images")
const jobs = [
  { from: "auth-background.png", to: "app-bg-tiny.webp", width: 64 },
  { from: "auth-background-mobile.png", to: "app-bg-tiny-mobile.webp", width: 36 },
]

for (const job of jobs) {
  const out = path.join(dir, job.to)
  await sharp(path.join(dir, job.from))
    .resize({ width: job.width, kernel: "lanczos3" })
    .blur(0.8) // a touch of softness so the upscale shows no blocks
    .webp({ quality: 82, effort: 6 })
    .toFile(out)
  const { size } = await stat(out)
  console.log(`${job.to}  ${(size / 1024).toFixed(1)} KB`)
}
