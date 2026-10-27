import { readFile } from "node:fs/promises"
import path from "node:path"

import { ImageResponse } from "next/og"

export const alt = "Organizzou — Em breve"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// The logo (white lettering) on Tinta, with a Lima accent.
export default async function Image() {
  const logo = await readFile(path.join(process.cwd(), "public/brand/logo-branca.png"))
  const src = `data:image/png;base64,${logo.toString("base64")}`

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 40, background: "#0C0E07" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={800} height={182} alt="" />
        <div style={{ width: 120, height: 8, borderRadius: 8, background: "#DBFD00" }} />
      </div>
    ),
    size
  )
}
