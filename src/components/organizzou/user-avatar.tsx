"use client"

import { useSyncExternalStore } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { localAvatarRepo } from "@/features/settings/avatar"

/** The photo kept on this device (the fallback), read without a hydration mismatch. */
export function useLocalAvatar(): string | null {
  return useSyncExternalStore(localAvatarRepo.subscribe, localAvatarRepo.load, () => null)
}

/** The person's avatar everywhere: the saved photo (server), else the one kept on this device, else the initials. */
export function UserAvatar({ initials, url, className, fallbackClassName }: { initials: string; url?: string | null; className?: string; fallbackClassName?: string }) {
  const local = useLocalAvatar()
  const src = url ?? local
  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt="" className="object-cover" /> : null}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  )
}
