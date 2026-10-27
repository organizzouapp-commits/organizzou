// Pre-renders the static backgrounds of the app shell (/dashboard/*) from the ORIGINAL sharp auth photos, so the app needs no
// CSS filter and no backdrop-filter at runtime. The login and the coming-soon page keep using the sharp originals untouched.
//
//   public/images/app-bg.webp, app-bg-mobile.webp   lightly blurred photo = the fixed full-screen base layer (AppBackground)
//   public/images/app-bg-frost.webp                 heavily blurred photo = the copy painted INSIDE the big frame (FrameGlass)
//
// >>> TWEAK THE BLUR HERE <<< Strengths are Gaussian sigmas in pixels of each ORIGINAL photo at its own width; each output
// is scaled down proportionally, so the look is the same at any export size.
//   BASE_BLUR  ~6-8  just softens details; colors and light streaks stay recognizable.
//   FROST_BLUR ~80-96 soft, diffuse glass. Raise it for more frost, lower it for less.
// Both layers are derived from the SAME sharp original (never blur the blurred one: that causes banding) and keep its aspect
// ratio, so with object-fit: cover they stay aligned pixel for pixel. The heavy blur is low-frequency, hence the small export.
// Phones have no frame (FrameGlass is md+ only), so no mobile frost image is generated.
//
// Uses the sharp that Next.js already installs. Run after changing the auth background or the strengths:
//   npm run glass-bg
import { stat } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

const BASE_BLUR = 7
const FROST_BLUR = 88

const dir = path.join(process.cwd(), "public", "images")
const jobs = [
  { from: "auth-background.png", to: "app-bg.webp", width: 1671, blur: BASE_BLUR, quality: 80 },
  { from: "auth-background-mobile.png", to: "app-bg-mobile.webp", width: 900, blur: BASE_BLUR, quality: 80 },
  { from: "auth-background.png", to: "app-bg-frost.webp", width: 960, blur: FROST_BLUR, quality: 85 },
]

for (const job of jobs) {
  const source = sharp(path.join(dir, job.from))
  const sigma = (job.blur * job.width) / (await source.metadata()).width
  const resized = await source.resize({ width: job.width }).toBuffer({ resolveWithObject: true })
  const { width, height } = resized.info
  // Mirror the borders before blurring so the edges do not fade toward black, then crop back to the exact size.
  const pad = Math.ceil(sigma * 3)
  const extended = await sharp(resized.data)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, extendWith: "mirror" })
    .toBuffer()
  const blurred = await sharp(extended).blur(sigma).toBuffer()
  const padded = await sharp(blurred).extract({ left: pad, top: pad, width, height }).toBuffer()
  const out = path.join(dir, job.to)
  await sharp(padded).webp({ quality: job.quality, effort: 6 }).toFile(out)
  const { size } = await stat(out)
  console.log(`${job.to}  ${width}x${height}  sigma ${sigma.toFixed(1)}  ${(size / 1024).toFixed(1)} KB`)
}
