import { cn } from "@/lib/utils"

import { modules, type ModuleId } from "./modules"

type ModuleIconProps = {
  module: ModuleId
  /** Also render the module name next to the icon. */
  showName?: boolean
  className?: string
}

export function ModuleIcon({ module, showName = false, className }: ModuleIconProps) {
  const { icon: Icon, name } = modules[module]

  return (
    <span className={cn("inline-flex items-center gap-3 text-foreground", className)}>
      <Icon
        aria-hidden={showName}
        aria-label={showName ? undefined : name}
        strokeWidth={1.75}
        className="size-5 text-muted-foreground"
      />
      {showName ? <span className="text-sm font-medium">{name}</span> : null}
    </span>
  )
}
