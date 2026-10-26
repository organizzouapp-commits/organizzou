import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description?: string
  /** Primary actions, aligned to the right on wide screens. */
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em] md:text-[28px] md:leading-[34px]">
          {title}
        </h1>
        {description ? <p className="text-base leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
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
