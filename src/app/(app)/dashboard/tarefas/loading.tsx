import { Skeleton } from "@/components/ui/skeleton"

/** The Tarefas layout while the board loads (after 200 ms): toolbar card, then three columns of cards. */
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="page-skeleton flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-[24px] border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-10 w-48 rounded-full" />
          <Skeleton className="ml-auto h-10 w-28 rounded-full max-md:hidden" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[64, 80, 110, 96, 88].map((w) => (
            <Skeleton key={w} className="h-9 shrink-0 rounded-full" style={{ width: w }} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[repeat(auto-fill,minmax(300px,380px))]">
        {[0, 1, 2].map((c) => (
          <div key={c} className="flex flex-col gap-2 rounded-[16px] border border-border bg-card p-3 max-md:[&:not(:first-child)]:hidden">
            <Skeleton className="mb-1 h-6 w-32" />
            {[0, 1, 2, 3].map((r) => (
              <Skeleton key={r} className="h-[84px] w-full rounded-[14px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
