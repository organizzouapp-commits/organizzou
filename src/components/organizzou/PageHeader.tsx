import { cn } from "@/lib/utils"

type PageHeaderProps = {
  /** Kept for readability at call sites: the page title and subtitle live in the top bar. */
  title?: string
  description?: string
  /** Secondary actions for the page. The primary action is registered with `usePrimaryAction`. */
  actions?: React.ReactNode
  className?: string
}

/** Page-level toolbar. It no longer repeats the title: the shell's top bar shows it (DESIGN-SYSTEM §5.2). */
export function PageHeader({ actions, className }: PageHeaderProps) {
  if (!actions) return null
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{actions}</div>
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase",
        className
      )}
    >
      {children}
    </h2>
  )
}
