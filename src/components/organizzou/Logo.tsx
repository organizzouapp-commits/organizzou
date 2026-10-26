import Image from "next/image"

import { cn } from "@/lib/utils"

type LogoProps = {
  /** Show only the app icon instead of the full wordmark. */
  iconOnly?: boolean
  /**
   * Which wordmark to use. "auto" follows the theme; "on-dark" always uses the Papel wordmark
   * (for surfaces that stay dark in both themes, like the sidebar and the auth highlight panel).
   */
  tone?: "auto" | "on-dark"
  className?: string
}

// Wordmark minimum width is 96 px, icon minimum is 16 px (DESIGN-SYSTEM §3).
export function Logo({ iconOnly = false, tone = "auto", className }: LogoProps) {
  if (iconOnly) {
    return (
      <Image
        src="/brand/organizzou-icone.svg"
        alt="Organizzou"
        width={120}
        height={120}
        className={cn("size-10", className)}
        priority
      />
    )
  }

  if (tone === "on-dark") {
    return (
      <Image
        src="/brand/organizzou-logotipo-modo-escuro.svg"
        alt="Organizzou"
        width={597}
        height={136}
        className={cn("h-10 w-auto", className)}
        priority
      />
    )
  }

  return (
    <>
      <Image
        src="/brand/organizzou-logotipo-modo-escuro.svg"
        alt="Organizzou"
        width={597}
        height={136}
        className={cn("hidden h-10 w-auto dark:block", className)}
        priority
      />
      <Image
        src="/brand/organizzou-logotipo-modo-claro.svg"
        alt="Organizzou"
        width={597}
        height={136}
        className={cn("block h-10 w-auto dark:hidden", className)}
        priority
      />
    </>
  )
}
