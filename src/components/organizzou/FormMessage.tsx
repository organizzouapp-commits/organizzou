import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type FormMessageProps = {
  kind: "error" | "success"
  children: React.ReactNode
  className?: string
}

// Icon + text, never color alone (DESIGN-SYSTEM §2.2).
export function FormMessage({ kind, children, className }: FormMessageProps) {
  const Icon = kind === "error" ? CircleAlertIcon : CircleCheckIcon

  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2 text-[13px] leading-5", className)}
    >
      <Icon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
