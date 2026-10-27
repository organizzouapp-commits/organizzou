import Image from "next/image"

import { cn } from "@/lib/utils"

/** Text and glass on the photo follow the theme, like the auth panel: dark -> Tinta (logo-preta), light -> Papel (logo-branca). */
export const ON_PHOTO = "text-palette-papel dark:text-palette-tinta"

/** Staggered entrance index (see .site-* in globals.css). */
export const reveal = (index: number) => ({ "--reveal": index }) as React.CSSProperties

export function SiteLogo({ className }: { className?: string }) {
  return (
    <>
      <Image src="/brand/logo-preta.png" alt="Organizzou" width={3000} height={683} loading="eager" className={cn("hidden w-auto dark:block", className)} />
      <Image src="/brand/logo-branca.png" alt="Organizzou" width={3000} height={683} loading="eager" className={cn("block w-auto dark:hidden", className)} />
    </>
  )
}
