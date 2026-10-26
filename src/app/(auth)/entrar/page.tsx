import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import { SignInForm } from "@/components/auth/sign-in-form"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = { title: "Entrar — Organizzou" }

type SearchParams = Promise<{ next?: string; erro?: string }>

async function SignInContent({ searchParams }: { searchParams: SearchParams }) {
  const { next, erro } = await searchParams
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/hoje"

  return <SignInForm next={safeNext} linkError={erro === "link"} />
}

export default function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em]">Entrar</h1>
        <p className="text-base leading-6 text-muted-foreground">Bom te ver de novo.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
      <p className="text-[15px] leading-6 text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastrar" className="font-medium text-foreground underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </>
  )
}
