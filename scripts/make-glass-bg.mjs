// Pre-renders the blurred app background (public/images/app-bg-blur*.webp) from the auth photo, so the app never needs a
// live backdrop-filter for that layer. The blur is baked in at half size (sigma 18 at ~57% size ≈ a 32 px CSS blur on the full image)
// and the browser upscales it, which keeps the files tiny. Run after changing the auth background:
// Uses the sharp that Next.js already installs.
//   npm run glass-bg
import { stat } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

const dir = path.join(process.cwd(), "public", "images")
const jobs = [
  { from: "auth-background.png", to: "app-bg-blur.webp", width: 960, sigma: 18 },
  { from: "auth-background-mobile.png", to: "app-bg-blur-mobile.webp", width: 540, sigma: 18 },
]

for (const job of jobs) {
  const out = path.join(dir, job.to)
  await sharp(path.join(dir, job.from))
    .resize({ width: job.width })
    .blur(job.sigma)
    .webp({ quality: 80, effort: 6 })
    .toFile(out)
  const { size } = await stat(out)
  console.log(`${job.to}  ${(size / 1024).toFixed(1)} KB`)
}
