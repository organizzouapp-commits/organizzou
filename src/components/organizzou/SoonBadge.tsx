import { Badge } from "@/components/ui/badge"

/** Marks a feature that is designed but not built yet. Always paired with a disabled control and a short explanation (docs/INTEGRATIONS-STATUS.md). */
export function SoonBadge({ className }: { className?: string }) {
  return (
    <Badge variant="secondary" className={className}>
      Em breve
    </Badge>
  )
}
