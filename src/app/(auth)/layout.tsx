import { Suspense } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Skeleton } from "@/components/ui/skeleton"

// One shared client shell for every auth route: it stays mounted while the URL changes,
// which is what lets the highlight panel slide between /entrar and /cadastro.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<Skeleton className="mx-auto my-10 h-[720px] w-full max-w-[1200px] rounded-[28px]" />}>
        <AuthShell />
      </Suspense>
      {/* The pages render nothing: the shell draws the form that matches the URL. */}
      {children}
    </>
  )
}
