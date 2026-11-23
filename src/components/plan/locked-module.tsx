"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CheckIcon, LockIcon } from "lucide-react"

import { usePlan } from "@/components/organizzou/plan-context"
import { PLANS_HREF } from "@/components/shell/plan-cta"
import { Button } from "@/components/ui/button"
import { canUse } from "@/lib/plans"
import { MODULE_BENEFITS, moduleForPath } from "@/lib/plan-routes"

import { launchPriceText } from "./plan-model"

/** The screen of a module the plan does not include. Nothing is deleted: what is stored stays, and comes back with Pro. */
export function LockedModule({ name, feature }: { name: string; feature: string }) {
  const benefits = MODULE_BENEFITS[feature] ?? []
  return (
    <section aria-label={`${name} faz parte do Pro`} data-testid="locked-module" className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-10 md:py-16">
      <span aria-hidden className="grid size-14 place-items-center rounded-full bg-highlight text-highlight-foreground">
        <LockIcon strokeWidth={1.75} className="size-7" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-[28px] leading-8 font-semibold tracking-[-0.02em]">{name} faz parte do Pro</h2>
        <p className="text-[15px] leading-6 text-muted-foreground">Seus dados em {name} continuam guardados e voltam assim que o Pro voltar.</p>
      </div>
      <ul className="flex flex-col">
        {benefits.map((text) => (
          <li key={text} className="flex min-h-12 items-center gap-3 border-b border-border py-2 text-[15px] leading-6 last:border-b-0">
            <CheckIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
            {text}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <Button asChild size="lg" className="h-12 rounded-full">
          <Link href={PLANS_HREF}>Experimentar por {launchPriceText()}</Link>
        </Button>
        <Button asChild size="lg" variant="ghost" className="h-12 rounded-full">
          <Link href={PLANS_HREF}>Ver todos os planos</Link>
        </Button>
      </div>
    </section>
  )
}

/** Wraps the page: a locked module shows its screen instead. Only UX: the server refuses the writes of a locked module anyway. */
export function ModuleLock({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { plan } = usePlan()
  const found = moduleForPath(pathname)
  if (found && !canUse(plan, found.feature)) return <LockedModule name={found.name} feature={found.feature} />
  return <>{children}</>
}

/** A small lock next to a menu entry whose module is Pro and the person is not. */
export function NavLock({ href }: { href: string }) {
  const { plan } = usePlan()
  const found = moduleForPath(href)
  if (!found || canUse(plan, found.feature)) return null
  return <LockIcon aria-label="Faz parte do Pro" role="img" strokeWidth={1.75} className="ml-auto size-4 shrink-0 text-muted-foreground" />
}
