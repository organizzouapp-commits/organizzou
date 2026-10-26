import Link from "next/link"

import { Logo } from "@/components/organizzou/Logo"
import { ThemeToggle } from "@/components/organizzou/ThemeToggle"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-4 py-6 md:px-0">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="Organizzou">
          <Logo className="h-9" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col justify-center gap-8 py-12">{children}</main>
      <footer className="flex gap-4 text-[13px] leading-5 text-muted-foreground">
        <Link href="/termos" className="underline-offset-4 hover:text-foreground hover:underline">
          Termos de uso
        </Link>
        <Link href="/privacidade" className="underline-offset-4 hover:text-foreground hover:underline">
          Privacidade
        </Link>
      </footer>
    </div>
  )
}
