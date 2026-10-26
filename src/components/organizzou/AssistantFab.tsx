"use client"

import { MicIcon, SparklesIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type AssistantFabProps = {
  onClick?: () => void
  /** Switches the icon to the microphone (audio mode). */
  audio?: boolean
  className?: string
}

export function AssistantFab({ onClick, audio = false, className }: AssistantFabProps) {
  const Icon = audio ? MicIcon : SparklesIcon

  return (
    <button
      type="button"
      aria-label={audio ? "Falar com o assistente" : "Abrir o assistente"}
      onClick={onClick}
      className={cn(
        "flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-transform duration-120 ease-organizzou focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
        className
      )}
    >
      <Icon aria-hidden strokeWidth={1.75} className="size-6" />
    </button>
  )
}
