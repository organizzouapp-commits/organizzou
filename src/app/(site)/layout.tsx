import type { Metadata } from "next"

import { PRELOADER_BOOT, SitePreloader } from "@/components/site/site-preloader"

const DESCRIPTION = "O app que organiza sua vida: tarefas, finanças, treinos, estudos e um assistente no WhatsApp, num só lugar."

// Public marketing pages: no app shell, only the root providers (theme, toaster, cookie consent).
// The title comes from the root layout (default). Open Graph is replaced as a whole, so repeat the shared fields.
export const metadata: Metadata = {
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Organizzou", locale: "pt_BR", title: "Organizzou - Sua vida organizada", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: "Organizzou - Sua vida organizada", description: DESCRIPTION },
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Decides before first paint whether the preloader shows (once per session, never with reduced motion). */}
      <script dangerouslySetInnerHTML={{ __html: PRELOADER_BOOT }} />
      <noscript>
        <style>{"#site-preloader{display:none}"}</style>
      </noscript>
      <SitePreloader />
      {children}
    </>
  )
}
