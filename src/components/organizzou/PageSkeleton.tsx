import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Route-level loading skeletons (used by each dashboard `loading.tsx`). They share the bento rhythm of the real screens so
 * nothing jumps when the content arrives, and they only appear after 200 ms (CSS animation delay, no timers): a fast
 * navigation never flashes a skeleton.
 */
type Layout = "bento" | "list" | "board" | "settings" | "form"

const card = "rounded-[24px] border border-border bg-card p-6"

function Row({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 border-b border-border py-3 last:border-b-0", className)}>
      <Skeleton className="size-5 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

function Stats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))" }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(card, "flex h-[140px] flex-col justify-between")}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

function CardList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn(card, className)}>
      <Skeleton className="mb-4 h-5 w-40" />
      {Array.from({ length: rows }, (_, i) => (
        <Row key={i} />
      ))}
    </div>
  )
}

export function PageSkeleton({ layout = "bento" }: { layout?: Layout }) {
  return (
    <div role="status" aria-label="Carregando" className="page-skeleton flex flex-col gap-5">
      {layout === "bento" ? (
        <>
          <Stats />
          <div className="grid gap-5 @min-[900px]:grid-cols-[7fr_5fr]">
            <CardList rows={4} />
            <CardList rows={4} />
          </div>
        </>
      ) : null}
      {layout === "list" ? (
        <>
          <Skeleton className="h-11 w-72 rounded-full" />
          <CardList rows={7} />
        </>
      ) : null}
      {layout === "board" ? (
        <>
          <Skeleton className="h-11 w-full max-w-md rounded-full" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, c) => (
              <div key={c} className={cn(card, "flex flex-col gap-3")}>
                <Skeleton className="h-5 w-28" />
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}
      {layout === "settings" ? (
        <>
          <Skeleton className="h-11 w-full max-w-lg rounded-full" />
          <div className={cn(card, "flex max-w-3xl flex-col gap-5")}>
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 4 }, (_, i) => (
              <Row key={i} />
            ))}
          </div>
        </>
      ) : null}
      {layout === "form" ? (
        <div className={cn(card, "flex max-w-3xl flex-col gap-5")}>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-40 rounded-full" />
        </div>
      ) : null}
    </div>
  )
}
