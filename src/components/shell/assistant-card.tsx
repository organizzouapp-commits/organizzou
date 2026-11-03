"use client"

import { SparklesIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-context"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const ease = "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"

/**
 * The virtual assistant's entry (Pro only). It takes the slot of the upgrade card: same width, radius 16, solid surface and hairline
 * border. Lima appears only in the icon container. The whole card is one button that opens the assistant.
 */
export function AssistantCard({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const { openAssistant } = useAssistant()
  return (
    <button
      type="button"
      data-testid="assistant-card"
      onClick={() => {
        onNavigate?.()
        openAssistant()
      }}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-[16px] bg-highlight p-3 text-left text-highlight-foreground outline-none hover:ring-2 hover:ring-highlight-foreground/20 focus-visible:ring-2 focus-visible:ring-highlight-foreground/20 [@media(max-height:900px)]:p-2.5",
        ease,
        className
      )}
    >
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-highlight-foreground/10">
        <SparklesIcon strokeWidth={1.75} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] leading-5 font-semibold">Assistente virtual</span>
        <span className="truncate text-[13px] leading-5 text-highlight-foreground/70">Pergunte ou peça algo</span>
      </span>
    </button>
  )
}

/** Collapsed rail: one 44 px icon button in the same slot (Pro only). */
export function AssistantRailButton({ className }: { className?: string }) {
  const { openAssistant } = useAssistant()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Assistente virtual"
          data-testid="assistant-rail-button"
          onClick={openAssistant}
          className={cn("flex size-11 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50", ease, className)}
        >
          <SparklesIcon aria-hidden strokeWidth={1.75} className="size-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">Assistente virtual</TooltipContent>
    </Tooltip>
  )
}

/** Phones only (the sidebar is a drawer there): the 56 px Lima circle that opens the assistant. Pro only; the shell hides it while the assistant is open. */
export function AssistantFloatingButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label="Abrir assistente virtual"
      data-testid="assistant-fab"
      onClick={onClick}
      className={cn("flex size-14 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground outline-none transition-transform duration-120 ease-organizzou focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95", className)}
    >
      <SparklesIcon aria-hidden strokeWidth={1.75} className="size-6" />
    </button>
  )
}
