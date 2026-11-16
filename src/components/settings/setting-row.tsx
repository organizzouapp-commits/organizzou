"use client"

import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * One row of a settings card: a round icon container, a title (with an optional badge) over a description, and the controls on the right.
 * Used by every row of "Segurança da conta", the passkey list and "Sessões ativas", so they share the same sizes, paddings and dividers.
 * On narrow cards the controls drop under the text; with fullWidthControlsOnMobile they fill the row (44px tall buttons).
 */
export function SettingRow({
  icon: Icon,
  title,
  badge,
  description,
  children,
  interactive = false,
  fullWidthControlsOnMobile = false,
  ...rest
}: {
  icon: LucideIcon
  title: React.ReactNode
  badge?: React.ReactNode
  description: React.ReactNode
  children?: React.ReactNode
  /** A list item: subtle hover background. */
  interactive?: boolean
  fullWidthControlsOnMobile?: boolean
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <div
      {...rest}
      className={cn(
        "flex min-h-16 flex-wrap items-center gap-x-4 gap-y-3 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0",
        interactive && "-mx-2 rounded-xl px-2 transition-colors duration-[400ms] first:pt-3 last:pb-3 hover:bg-muted/50 motion-reduce:transition-none"
      )}
    >
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40">
        <Icon strokeWidth={1.75} className="size-[18px]" />
      </span>
      <div className="flex min-w-0 flex-1 basis-48 flex-col">
        <span className="flex flex-wrap items-center gap-2 text-[15px] leading-6 font-semibold">
          <span className="min-w-0 truncate">{title}</span>
          {badge}
        </span>
        <span className="text-[13px] leading-5 text-muted-foreground">{description}</span>
      </div>
      {children ? <div className={cn("flex shrink-0 items-center gap-2", fullWidthControlsOnMobile && "max-sm:w-full max-sm:[&>button]:flex-1")}>{children}</div> : null}
    </div>
  )
}

/** A 44px icon button with a tooltip (and the same text as its accessible name). */
export function RowAction({ label, icon: Icon, onClick, disabled }: { label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={label} disabled={disabled} onClick={onClick} className="size-11 rounded-full text-muted-foreground hover:text-foreground">
          <Icon strokeWidth={1.75} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}
