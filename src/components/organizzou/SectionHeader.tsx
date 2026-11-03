import { cn } from "@/lib/utils"

/**
 * The overline that opens a section of a screen ("DESTAQUES", "SEU DIA", "PRECISA DE VOCÊ"): 11 px, 600, tracking .12em, uppercase,
 * with optional actions on the right. The row is 36 px high on desktop (44 px on phones, where the actions are touch targets); the
 * section puts a 12 px gap between this row and its content.
 */
export function SectionHeader({ title, actions, className }: { title: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-3 md:h-9 md:min-h-0", className)}>
      <h2 className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{title}</h2>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
