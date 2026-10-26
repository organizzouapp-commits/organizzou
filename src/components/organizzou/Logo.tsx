import Image from "next/image"

import { cn } from "@/lib/utils"

type LogoProps = {
  /** Show only the app icon instead of the full wordmark. */
  iconOnly?: boolean
  className?: string
}

// Wordmark minimum width is 96 px, icon minimum is 16 px (DESIGN-SYSTEM §3).
export function Logo({ iconOnly = false, className }: LogoProps) {
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
