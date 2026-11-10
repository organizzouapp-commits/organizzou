import { cn } from "@/lib/utils"

/** The Organizzou mark (three bars and the two diagonals) drawn with the current text color, so it can sit on a Lima button in both themes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 256 256" className={cn("size-7", className)}>
      <path className="fill-current opacity-60" d="M191.50,30.14L47.50,113.28L64.50,142.72L208.50,59.58Z" />
      <path className="fill-current opacity-60" d="M191.50,113.28L47.50,196.42L64.50,225.86L208.50,142.72Z" />
      <path className="fill-current" d="M56.00,27.86H200.00A17.0,17.0 0 0 1 200.00,61.86H56.00A17.0,17.0 0 0 1 56.00,27.86Z" />
      <path className="fill-current" d="M56.00,111.00H200.00A17.0,17.0 0 0 1 200.00,145.00H56.00A17.0,17.0 0 0 1 56.00,111.00Z" />
      <path className="fill-current" d="M56.00,194.14H200.00A17.0,17.0 0 0 1 200.00,228.14H56.00A17.0,17.0 0 0 1 56.00,194.14Z" />
    </svg>
  )
}
