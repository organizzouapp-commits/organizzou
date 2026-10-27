// Pre-renders the blurred copy of the auth photo used INSIDE the app's big frame (the "fake frosted glass"):
// public/images/app-bg-frost.webp. A strong blur (~48 px on the full-size image) is baked in at 1280 px wide (sigma 37), so the
// app needs no CSS filter and no backdrop-filter at runtime. The sharp photo (full quality) is the page background; the frame
// shows this blurred copy aligned exactly with it (same aspect ratio, object-fit: cover, same focal point).
// Only the desktop image is needed: on phones there is no frame, so the sharp mobile photo + tint is used.
// Uses the sharp that Next.js already installs. Run after changing the auth background:
//   npm run glass-bg
import { stat } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

const dir = path.join(process.cwd(), "public", "images")
const jobs = [{ from: "auth-background.png", to: "app-bg-frost.webp", width: 1280, sigma: 37 }]

for (const job of jobs) {
  const out = path.join(dir, job.to)
  await sharp(path.join(dir, job.from))
    .resize({ width: job.width })
    .blur(job.sigma)
    .webp({ quality: 82, effort: 6 })
    .toFile(out)
  const { size } = await stat(out)
  console.log(`${job.to}  ${(size / 1024).toFixed(1)} KB`)
}
