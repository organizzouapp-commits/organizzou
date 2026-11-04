import { Skeleton } from "@/components/ui/skeleton"

/** The loading state of Finanças: the same shapes as the bento screen (tabs, hero, stat tiles, cards), radius 20, no spinner. */
export function FinanceSkeleton() {
  return (
    <div data-testid="finance-skeleton" aria-hidden className="flex flex-col gap-4 pb-24 md:pb-0">
      <div className="flex gap-2">
        {[88, 100, 96, 64].map((w) => (
          <Skeleton key={w} className="h-9 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-8 xl:grid-cols-12 md:gap-4">
        <Skeleton className="col-span-2 h-44 rounded-[20px] lg:col-span-8 xl:col-span-5" />
        <div className="col-span-2 grid grid-cols-2 gap-3 md:gap-4 lg:col-span-8 xl:col-span-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[84px] rounded-[20px] md:h-[104px]" />
          ))}
        </div>
        <Skeleton className="col-span-2 hidden h-44 rounded-[20px] md:block lg:col-span-8 xl:col-span-3" />
        <Skeleton className="col-span-2 h-64 rounded-[20px] lg:col-span-8 xl:col-span-7" />
        <Skeleton className="col-span-2 h-64 rounded-[20px] lg:col-span-8 xl:col-span-5" />
      </div>
    </div>
  )
}
